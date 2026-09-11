const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/db');
const { audit } = require('../utils/audit');

function validatePassword(password) {
    return typeof password === 'string' && password.length >= 12;
}

async function login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Username and password required.'
        });
    }

    const result = await query(
        `SELECT
            u.*,
            st.name AS station_name
         FROM users u
         LEFT JOIN stations st ON st.id = u.station_id
         WHERE u.username = $1`,
        [username.trim()]
    );

    if (!result.rowCount || !result.rows[0].active) {
        return res.status(401).json({
            error: 'Invalid credentials.'
        });
    }

    const user = result.rows[0];

    const ok = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!ok) {
        return res.status(401).json({
            error: 'Invalid credentials.'
        });
    }

    const jti = crypto.randomUUID();
    const session_minutes=15;
    const expiresAt = new Date(Date.now() +session_minutes * 60 * 1000);

    await query(
        'INSERT INTO sessions(jti, user_id, expires_at) VALUES($1, $2, $3)',
        [jti, user.id, expiresAt]
    );

    const token = jwt.sign(
        {
            sub: user.id,
            jti,
            role: user.role,
            station_id: user.station_id,
            must_change_password: user.must_change_password
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '15m'
        }
    );

    await audit(
        {
            actorUserId: user.id,
            ip: req.ip
        },
        'LOGIN_SUCCESS',
        'user',
        user.id,
        user.station_id,
        {
            username: user.username
        }
    );

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            station_id: user.station_id,
            station_name: user.station_name,
            must_change_password: user.must_change_password
        }
    });
}

async function logout(req, res) {
    await query(
        'UPDATE sessions SET revoked_at = NOW() WHERE jti = $1',
        [req.user.jti]
    );

    await audit(
        req,
        'LOGOUT',
        'session',
        req.user.jti,
        req.user.station_id
    );

    res.json({
        message: 'Session revoked.'
    });
}

async function getRecoveryQuestion(req, res) {
    const username = String(req.body.username || '').trim();

    if (!username) {
        return res.status(400).json({
            error: 'Username required.'
        });
    }

    const result = await query(
        `SELECT security_question
         FROM users
         WHERE username = $1
           AND active = true`,
        [username]
    );

    if (!result.rowCount) {
        return res.status(404).json({
            error: 'Account not found.'
        });
    }

    res.json({
        question: result.rows[0].security_question
    });
}

async function resetWithSecurityAnswer(req, res) {
    const {
        username,
        security_answer,
        new_password
    } = req.body;

    if (
        !username ||
        !security_answer ||
        !validatePassword(new_password)
    ) {
        return res.status(400).json({
            error: 'Valid username, answer and 12+ character password required.'
        });
    }

    const result = await query(
        'SELECT * FROM users WHERE username = $1 AND active = true',
        [username.trim()]
    );

    if (!result.rowCount) {
        return res.status(404).json({
            error: 'Account not found.'
        });
    }

    const user = result.rows[0];

    const ok = await bcrypt.compare(
        security_answer.trim().toLowerCase(),
        user.security_answer_hash
    );

    if (!ok) {
        return res.status(401).json({
            error: 'Recovery challenge failed.'
        });
    }

    const hash = await bcrypt.hash(new_password, 12);

    await query(
        `UPDATE users
         SET password_hash = $1,
             must_change_password = false,
             updated_at = NOW()
         WHERE id = $2`,
        [hash, user.id]
    );

    await query(
        `UPDATE sessions
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND revoked_at IS NULL`,
        [user.id]
    );

    await audit(
        {
            user,
            ip: req.ip
        },
        'PASSWORD_RESET_BY_SECURITY_CHALLENGE',
        'user',
        user.id,
        user.station_id
    );

    res.json({
        message: 'Password reset. All previous sessions were revoked.'
    });
}

async function changePassword(req, res) {
    const {
        current_password,
        new_password
    } = req.body;

    if (!validatePassword(new_password)) {
        return res.status(400).json({
            error: 'New password must contain at least 12 characters.'
        });
    }

    const result = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
    );

    if(!result.rowCount){
        return res.status(404).json({error:'user account not found.'});
    }

    const ok = await bcrypt.compare(
        current_password || '',
        result.rows[0].password_hash
    );

    if (!ok) {
        return res.status(401).json({
            error: 'Current password is incorrect.'
        });
    }

    const hash = await bcrypt.hash(new_password, 12);

    await query(
        `UPDATE users
         SET password_hash = $1,
             must_change_password = false,
             updated_at = NOW()
         WHERE id = $2`,
        [hash, req.user.id]
    );

    await query(
        `UPDATE sessions
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND jti <> $2`,
        [req.user.id, req.user.jti]
    );

    await audit(
        req,
        'PASSWORD_CHANGED',
        'user',
        req.user.id,
        req.user.station_id
    );

    res.json({
        message: 'Password changed. Other sessions were revoked.'
    });
}

module.exports = {
    login,
    logout,
    getRecoveryQuestion,
    resetWithSecurityAnswer,
    changePassword
};