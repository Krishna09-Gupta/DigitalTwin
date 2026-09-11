const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

async function authenticate(req, res, next) {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({
            error: 'Authentication required.'
        });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const result = await query(
            `SELECT
                s.jti,
                s.expires_at,
                s.revoked_at,
                u.id,
                u.username,
                u.role,
                u.station_id,
                u.active,
                u.must_change_password,
                st.name AS station_name
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             LEFT JOIN stations st ON st.id = u.station_id
             WHERE s.jti = $1`,
            [payload.jti]
        );

        if (!result.rowCount) {
            return res.status(401).json({
                error: 'Session not found.'
            });
        }

        const session = result.rows[0];

        if (
            session.revoked_at ||
            new Date(session.expires_at) <= new Date() ||
            !session.active
        ) {
            return res.status(401).json({
                error: 'Session expired or revoked.'
            });
        }

        req.user = {
            id: session.id,
            username: session.username,
            role: session.role,
            station_id: session.station_id,
            station_name: session.station_name,
            jti: session.jti,
            must_change_password: session.must_change_password
        };

        next();
    } catch {
        return res.status(401).json({
            error: 'Invalid authentication token.'
        });
    }
}

function requirePasswordChangeComplete(req, res, next) {
    if (req.user?.must_change_password) {
        return res.status(428).json({
            error: 'Password change required before operational access.',
            code: 'PASSWORD_CHANGE_REQUIRED'
        });
    }

    next();
}

function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient role clearance.'
            });
        }

        next();
    };
}

module.exports = {
    authenticate,
    requirePasswordChangeComplete,
    authorizeRoles
};