const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { audit } = require('../utils/audit');

async function listUsers(req, res) {
    const result = await query(`
        SELECT
            u.id,
            u.username,
            u.role,
            u.station_id,
            st.name AS station_name,
            u.must_change_password,
            u.active,
            u.created_at
        FROM users u
        LEFT JOIN stations st ON st.id = u.station_id
        ORDER BY u.id
    `);

    res.json(result.rows);
}

async function createScientist(req, res) {
    const {
        username,
        password,
        station_id,
        security_question,
        security_answer
    } = req.body;

    if (
        !username ||
        !password ||
        password.length < 12 ||
        !station_id ||
        !security_question ||
        !security_answer
    ) {
        return res.status(400).json({
            error: 'Username, 12+ character temporary password, station and recovery challenge are required.'
        });
    }

    const exists = await query(
        'SELECT 1 FROM users WHERE username = $1',
        [username.trim()]
    );

    if (exists.rowCount) {
        return res.status(409).json({
            error: 'Username already exists.'
        });
    }

    const station = await query(
        'SELECT id FROM stations WHERE id = $1 AND active = true',
        [station_id]
    );

    if (!station.rowCount) {
        return res.status(400).json({
            error: 'Invalid station.'
        });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const answerHash = await bcrypt.hash(
        security_answer.trim().toLowerCase(),
        12
    );

    const result = await query(
        `INSERT INTO users (
            username,
            password_hash,
            role,
            station_id,
            security_question,
            security_answer_hash,
            must_change_password
        )
        VALUES ($1, $2, 'visiting_scientist', $3, $4, $5, true)
        RETURNING id, username, role, station_id`,
        [
            username.trim(),
            passwordHash,
            station_id,
            security_question.trim(),
            answerHash
        ]
    );

    await audit(
        req,
        'SCIENTIST_CREATED',
        'user',
        result.rows[0].id,
        station_id,
        {
            username: username.trim()
        }
    );

    res.status(201).json({
        message: 'Scientist account created with mandatory first-login password change.'
    });
}

async function adminResetUser(req, res) {
    const {
        user_id,
        temporary_password,
        security_question,
        security_answer
    } = req.body;

    if (!temporary_password || temporary_password.length < 12) {
        return res.status(400).json({
            error: 'Temporary password must contain at least 12 characters.'
        });
    }

    const user = await query(
        'SELECT * FROM users WHERE id = $1',
        [user_id]
    );

    if (!user.rowCount) {
        return res.status(404).json({
            error: 'User not found.'
        });
    }

    const passwordHash = await bcrypt.hash(temporary_password, 12);

    const answerHash = security_answer
        ? await bcrypt.hash(
            security_answer.trim().toLowerCase(),
            12
        )
        : user.rows[0].security_answer_hash;

    await query(
        `UPDATE users
         SET password_hash = $1,
             security_question = COALESCE($2, security_question),
             security_answer_hash = $3,
             must_change_password = true,
             updated_at = NOW()
         WHERE id = $4`,
        [
            passwordHash,
            security_question || null,
            answerHash,
            user_id
        ]
    );

    await query(
        'UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1',
        [user_id]
    );

    await audit(
        req,
        'ADMIN_CREDENTIAL_RESET',
        'user',
        user_id,
        user.rows[0].station_id,
        {
            target_username: user.rows[0].username,
            security_challenge_reset: Boolean(security_answer)
        }
    );

    res.json({
        message: 'Credentials reset. User must change the temporary password at next login.'
    });
}

async function setUserActive(req, res) {
    const { user_id, active } = req.body;

    if (Number(user_id) === req.user.id && active === false) {
        return res.status(400).json({
            error: 'Admin cannot deactivate the current session account.'
        });
    }

    const user = await query(
        'SELECT * FROM users WHERE id = $1',
        [user_id]
    );

    if (!user.rowCount) {
        return res.status(404).json({
            error: 'User not found.'
        });
    }

    await query(
        'UPDATE users SET active = $1, updated_at = NOW() WHERE id = $2',
        [Boolean(active), user_id]
    );

    if (!active) {
        await query(
            'UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1',
            [user_id]
        );
    }

    await audit(
        req,
        active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        'user',
        user_id,
        user.rows[0].station_id
    );

    res.json({
        message: active ? 'User activated.' : 'User deactivated.'
    });
}

async function createStation(req, res) {
    const { code, name, description } = req.body;

    if (!code || !name) {
        return res.status(400).json({
            error: 'Station code and name required.'
        });
    }

    const result = await query(
        `INSERT INTO stations(code, name, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
            code.trim().toUpperCase(),
            name.trim(),
            description || ''
        ]
    );

    await audit(
        req,
        'STATION_CREATED',
        'station',
        result.rows[0].id,
        result.rows[0].id,
        {
            code: result.rows[0].code,
            name: result.rows[0].name
        }
    );

    res.status(201).json(result.rows[0]);
}

async function getAuditLogs(req, res) {
    const limit = Math.min(
        Number(req.query.limit) || 100,
        500
    );

    const result = await query(
        `SELECT
            al.*,
            u.username,
            s.name AS station_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.actor_user_id
         LEFT JOIN stations s ON s.id = al.station_id
         ORDER BY al.created_at DESC
         LIMIT $1`,
        [limit]
    );

    res.json(result.rows);
}

module.exports = {
    listUsers,
    createScientist,
    adminResetUser,
    setUserActive,
    createStation,
    getAuditLogs
};