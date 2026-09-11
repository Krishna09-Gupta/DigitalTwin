const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false
});

router.post('/login', authLimiter, controller.login);
router.post('/logout', authenticate, controller.logout);

router.post(
    '/recovery/question',
    authLimiter,
    controller.getRecoveryQuestion
);

router.post(
    '/recovery/reset',
    authLimiter,
    controller.resetWithSecurityAnswer
);

router.post(
    '/change-password',
    authenticate,
    controller.changePassword
);

module.exports = router;