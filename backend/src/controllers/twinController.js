const { query, pool } = require('../config/db');
const { audit } = require('../utils/audit');

async function getStations(req, res) {
    const result = await query(
        `SELECT
            id,
            code,
            name,
            description,
            active
         FROM stations
         WHERE active = true
         ORDER BY id`
    );

    res.json(result.rows);
}

async function getMetrics(req, res) {
    const requested = req.query.station_id
        ? Number(req.query.station_id)
        : null;

    if (
        req.user.role !== 'admin' &&
        requested &&
        requested !== req.user.station_id
    ) {
        return res.status(403).json({
            error: 'Station scope violation.'
        });
    }

    const stationId = req.user.role === 'admin'
        ? requested
        : req.user.station_id;

    const params = stationId ? [stationId] : [];

    const sql = `
        SELECT
            tm.*,
            s.name AS station_name
        FROM telemetry_metrics tm
        JOIN stations s ON s.id = tm.station_id
        ${stationId ? 'WHERE tm.station_id = $1' : ''}
        ORDER BY tm.station_id, tm.id
    `;

    const result = await query(sql, params);

    res.json(result.rows);
}

async function adminOverride(req, res) {
    const { metric_id, manual_value } = req.body;

    if (!Number.isFinite(Number(manual_value))) {
        return res.status(400).json({
            error: 'Telemetry value must be numeric.'
        });
    }

    const result = await query(
        'SELECT * FROM telemetry_metrics WHERE id = $1',
        [metric_id]
    );

    if (!result.rowCount) {
        return res.status(404).json({
            error: 'Metric not found.'
        });
    }

    const metric = result.rows[0];
    const value = Number(manual_value);

    if((value<Number(metric.profile_min)) || value>Number(metric.profile_max)){
        return res.status(400).json({error:`Value must be between ${metric.profile_min} and ${metric.profile_max}.`});
    }

    await query(
        `UPDATE telemetry_metrics
         SET current_value = $1,
             is_overridden = true,
             updated_at = NOW()
         WHERE id = $2`,
        [value, metric_id]
    );

    await audit(
        req,
        'METRIC_MANUAL_LOCK',
        'telemetry_metric',
        metric_id,
        metric.station_id,
        {
            metric: metric.metric_name,
            value
        }
    );

    await pool.query(
        `SELECT pg_notify('telemetry_update', $1)`,
        [
            JSON.stringify({
                stationId: metric.station_id,
                metricId: metric_id
            })
        ]
    );

    res.json({
        message: 'Metric manually locked.'
    });
}

async function releaseOverride(req, res) {
    const { metric_id } = req.body;

    const result = await query(
        'SELECT * FROM telemetry_metrics WHERE id = $1',
        [metric_id]
    );

    if (!result.rowCount) {
        return res.status(404).json({
            error: 'Metric not found.'
        });
    }

    await query(
        `UPDATE telemetry_metrics
         SET is_overridden = false,
             updated_at = NOW()
         WHERE id = $1`,
        [metric_id]
    );

    await audit(
        req,
        'METRIC_MANUAL_UNLOCK',
        'telemetry_metric',
        metric_id,
        result.rows[0].station_id
    );

    res.json({
        message: 'Metric released to simulator.'
    });
}

async function proposeChange(req, res) {
    const {
        metric_id,
        proposed_value,
        justification
    } = req.body;

    if (
        !justification ||
        !Number.isFinite(Number(proposed_value))
    ) {
        return res.status(400).json({
            error: 'Proposed value and scientific justification are required.'
        });
    }

    const metric = await query(
        'SELECT tm.*, sp.min_value AS profile_min, sp.max_value AS profile_max FROM telemetry_metrics tm JOIN simulation_profiles sp ON sp.station_id=tm.station_id AND sp.metric_name=tm.metric_name WHERE tm.id = $1',
        [metric_id]
    );

    if (!metric.rowCount) {
        return res.status(404).json({
            error: 'Metric not found.'
        });
    }
    
    const value=Number(proposed_value);
    if((value<Number(metric.rows[0].profile_min)) || value>Number(metric.rows[0].profile_max)){
        return res.status(400).json({error:`Value must be between ${metric.profile_min} and  ${metric.profile_max}.`});
    }

    const m = metric.rows[0];

    if (
        req.user.role !== 'admin' &&
        m.station_id !== req.user.station_id
    ) {
        return res.status(403).json({
            error: 'Station scope violation.'
        });
    }

    const result = await query(
        `INSERT INTO condition_requests (
            station_id,
            metric_id,
            requested_by,
            proposed_value,
            justification
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
            m.station_id,
            metric_id,
            req.user.id,
            Number(proposed_value),
            justification.trim()
        ]
    );

    await audit(
        req,
        'CONDITION_CHANGE_PROPOSED',
        'condition_request',
        result.rows[0].id,
        m.station_id,
        {
            metric_id,
            proposed_value: Number(proposed_value)
        }
    );

    res.status(201).json(result.rows[0]);
}

async function getPendingRequests(req, res) {
    const result = await query(`
        SELECT
            cr.*,
            s.name AS station_name,
            tm.metric_name,
            u.username AS requested_by_username
        FROM condition_requests cr
        JOIN stations s ON s.id = cr.station_id
        JOIN telemetry_metrics tm ON tm.id = cr.metric_id
        JOIN users u ON u.id = cr.requested_by
        WHERE cr.status = 'PENDING'
        ORDER BY cr.id DESC
    `);

    res.json(result.rows);
}

async function getMyRequests(req,res){
    const result=await query('SELECT cr.*,s.name AS station_name,tm.metric_name FROM condition_requests cr JOIN stations s ON s.id=cr.station_id JOIN telemetry_metrics tm ON tm.id = cr.metric_id WHERE cr.requested_by=$1 ORDER BY cr.id DESC',[req.user.id]);
    res.json(result.rows);
}

async function resolveRequest(req, res) {
    const { request_id, action } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(action)) {
        return res.status(400).json({
            error: 'Invalid decision.'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const request = await client.query(
            `SELECT *
             FROM condition_requests
             WHERE id = $1
               AND status = 'PENDING'
             FOR UPDATE`,
            [request_id]
        );

        if (!request.rowCount) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                error: 'Pending request not found.'
            });
        }

        const r = request.rows[0];

        if (action === 'APPROVED') {
            await client.query(
                `UPDATE telemetry_metrics
                 SET current_value = $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [r.proposed_value, r.metric_id]
            );
        }

        await client.query(
            `UPDATE condition_requests
             SET status = $1,
                 reviewed_by = $2,
                 reviewed_at = NOW()
             WHERE id = $3`,
            [action, req.user.id, request_id]
        );

        await client.query('COMMIT');

        await audit(
            req,
            `CONDITION_REQUEST_${action}`,
            'condition_request',
            request_id,
            r.station_id,
            {
                metric_id: r.metric_id,
                proposed_value: r.proposed_value
            }
        );

        res.json({
            message: `Request ${action.toLowerCase()}.`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function emergencyOverride(req, res) {
    const { metric_id, reason } = req.body;

    if (!reason || reason.trim().length < 5) {
        return res.status(400).json({
            error: 'Emergency reason is required.'
        });
    }

    const metric = await query(
        'SELECT * FROM telemetry_metrics WHERE id = $1',
        [metric_id]
    );

    if (!metric.rowCount) {
        return res.status(404).json({
            error: 'Metric not found.'
        });
    }

    const m = metric.rows[0];

    if (
        req.user.role !== 'admin' &&
        m.station_id !== req.user.station_id
    ) {
        return res.status(403).json({
            error: 'Station scope violation.'
        });
    }

    const event = await query(
        `INSERT INTO emergency_events (
            station_id,
            metric_id,
            triggered_by,
            reason,
            previous_value
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [
            m.station_id,
            metric_id,
            req.user.id,
            reason.trim(),
            m.current_value
        ]
    );

    await query(
        `UPDATE telemetry_metrics
         SET is_overridden = true,
             updated_at = NOW()
         WHERE id = $1`,
        [metric_id]
    );

    await audit(
        req,
        'EMERGENCY_OVERRIDE_TRIGGERED',
        'emergency_event',
        event.rows[0].id,
        m.station_id,
        {
            metric_id,
            metric_name: m.metric_name,
            reason: reason.trim(),
            triggered_by_username: req.user.username
        }
    );

    res.status(201).json({
        message: 'Emergency override recorded and metric locked.'
    });
}

async function getEmergencyAlerts(req, res) {
    const result = await query(
        `SELECT
            ee.*,
            s.name AS station_name,
            tm.metric_name,
            tu.username AS triggered_by_username,
            ru.username AS resolved_by_username
         FROM emergency_events ee
         JOIN stations s ON s.id = ee.station_id
         JOIN telemetry_metrics tm ON tm.id = ee.metric_id
         JOIN users tu ON tu.id = ee.triggered_by
         LEFT JOIN users ru ON ru.id = ee.resolved_by
         WHERE ee.status = 'ACTIVE'
         ${req.user.role === 'admin' ? '' : 'AND ee.station_id = $1'}
         ORDER BY ee.created_at DESC`,
        req.user.role === 'admin'
            ? []
            : [req.user.station_id]
    );

    res.json(result.rows);
}

async function rollbackEmergency(req, res) {
    const { event_id } = req.body;

    const event = await query(
        `SELECT *
         FROM emergency_events
         WHERE id = $1
           AND status = $2`,
        [event_id, 'ACTIVE']
    );

    if (!event.rowCount) {
        return res.status(404).json({
            error: 'Active emergency event not found.'
        });
    }

    const e = event.rows[0];

    await query(
        `UPDATE telemetry_metrics
         SET current_value = COALESCE($1, current_value),
             is_overridden = false,
             updated_at = NOW()
         WHERE id = $2`,
        [e.previous_value, e.metric_id]
    );

    await query(
        `UPDATE emergency_events
         SET status = 'RESOLVED',
             resolved_by = $1,
             resolved_at = NOW()
         WHERE id = $2`,
        [req.user.id, event_id]
    );

    await audit(
        req,
        'EMERGENCY_OVERRIDE_RESOLVED',
        'emergency_event',
        event_id,
        e.station_id,
        {
            metric_id: e.metric_id
        }
    );

    res.json({
        message: 'Emergency override resolved.'
    });
}

async function getLogistics(req, res) {
    const requested = req.query.station_id
        ? Number(req.query.station_id)
        : null;

    if (
        req.user.role !== 'admin' &&
        requested &&
        requested !== req.user.station_id
    ) {
        return res.status(403).json({
            error: 'Station scope violation.'
        });
    }

    const stationId = req.user.role === 'admin'
        ? requested
        : req.user.station_id;

    const result = await query(
        `SELECT
            sl.*,
            s.name AS station_name
         FROM station_logistics sl
         JOIN stations s ON s.id = sl.station_id
         ${stationId ? 'WHERE sl.station_id = $1' : ''}
         ORDER BY sl.station_id, sl.category, sl.id`,
        stationId ? [stationId] : []
    );

    res.json(result.rows);
}

module.exports = {
    getStations,
    getLogistics,
    getMetrics,
    adminOverride,
    releaseOverride,
    proposeChange,
    getPendingRequests,
    resolveRequest,
    emergencyOverride,
    getEmergencyAlerts,
    rollbackEmergency,
    getMyRequests,
};