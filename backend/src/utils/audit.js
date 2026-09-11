const { query } = require('../config/db');

async function audit(
    req,
    action,
    entityType = null,
    entityId = null,
    stationId = null,
    details = {}
) {
    const actorId = req.user?.id ?? req.actorUserId ?? null;

    await query(
        `INSERT INTO audit_logs (
            actor_user_id,
            action,
            entity_type,
            entity_id,
            station_id,
            details,
            ip_address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            actorId,
            action,
            entityType,
            entityId ? String(entityId) : null,
            stationId || null,
            JSON.stringify(details),
            req.ip || null
        ]
    );
}

module.exports = {audit};