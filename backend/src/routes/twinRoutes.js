const express = require('express');
const controller = require('../controllers/twinController');
const admin = require('../controllers/adminController');

const {
    authenticate,
    requirePasswordChangeComplete,
    authorizeRoles
} = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requirePasswordChangeComplete);

router.get('/stations', controller.getStations);
router.get('/metrics', controller.getMetrics);
router.get('/logistics', controller.getLogistics);

router.post(
    '/admin/override',
    authorizeRoles('admin'),
    controller.adminOverride
);

router.post(
    '/admin/release',
    authorizeRoles('admin'),
    controller.releaseOverride
);

router.post(
    '/scientist/request-change',
    authorizeRoles('visiting_scientist', 'admin'),
    controller.proposeChange
);

router.get(
    '/scientist/my-requests',
    authorizeRoles('visiting_scientist'),
    controller.getMyRequests
);

router.get(
    '/admin/pending-requests',
    authorizeRoles('admin'),
    controller.getPendingRequests
);

router.post(
    '/admin/resolve-request',
    authorizeRoles('admin'),
    controller.resolveRequest
);

router.post(
    '/emergency/override',
    authorizeRoles('admin', 'visiting_scientist'),
    controller.emergencyOverride
);

router.get(
    '/emergency/active-alerts',
    controller.getEmergencyAlerts
);

router.post(
    '/admin/emergency/rollback',
    authorizeRoles('admin'),
    controller.rollbackEmergency
);

router.get(
    '/admin/users',
    authorizeRoles('admin'),
    admin.listUsers
);

router.post(
    '/admin/scientists',
    authorizeRoles('admin'),
    admin.createScientist
);

router.post(
    '/admin/users/reset-credentials',
    authorizeRoles('admin'),
    admin.adminResetUser
);

router.post(
    '/admin/users/status',
    authorizeRoles('admin'),
    admin.setUserActive
);

router.post(
    '/admin/stations',
    authorizeRoles('admin'),
    admin.createStation
);

router.get(
    '/admin/audit-logs',
    authorizeRoles('admin'),
    admin.getAuditLogs
);

module.exports = router;