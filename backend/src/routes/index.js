// ubndxanuicam/backend/src/routes/index.js
const express = require('express');
const router = express.Router();

// Require route modules defensively: a bad route file should not crash server
const safeRequire = (p) => {
    try {
        return require(p);
    } catch (e) {
        console.error('Failed to require route', p, e && (e.stack || e));
        return null;
    }
};

const authRoutes = safeRequire('./authRoutes');
const userRoutes = safeRequire('./userRoutes');
const taskRoutes = safeRequire('./taskRoutes');
const roleRoutes = safeRequire('./roleRoutes');
const departmentRoutes = safeRequire('./departmentRoutes');
const reportRoutes = safeRequire('./reportRoutes');
const auditLogRoutes = safeRequire('./auditLogRoutes');
const systemSettingsRoutes = safeRequire('./systemSettingsRoutes');
const articleRoutes = safeRequire('./articleRoutes');
const feedbackRoutes = safeRequire('./feedbackRoutes');
const notificationRoutes = safeRequire('./notificationRoutes');
const meetingRoutes = safeRequire('./meetingRoutes');
const computerConfigRoutes = safeRequire('./computerConfigRoutes');
const calendarRoutes = safeRequire('./calendarRoutes');
const roomBookingRoutes = safeRequire('./roomBookingRoutes');
const approvalRoutes = safeRequire('./approvalRoutes');
const devRoutes = safeRequire('./devRoutes');

// Định nghĩa một mảng chứa tất cả các routes và tiền tố API của chúng
const apiRoutes = [
    { path: '/auth', route: authRoutes },
    { path: '/users', route: userRoutes },
    { path: '/tasks', route: taskRoutes },
    { path: '/roles', route: roleRoutes },
    { path: '/departments', route: departmentRoutes },
    { path: '/reports', route: reportRoutes },
    { path: '/audit-logs', route: auditLogRoutes },
    { path: '/system', route: systemSettingsRoutes },
    { path: '/articles', route: articleRoutes },
    { path: '/feedback', route: feedbackRoutes },
    { path: '/notifications', route: notificationRoutes },
    { path: '/meetings', route: meetingRoutes },
    { path: '/computer-configs', route: computerConfigRoutes },
    { path: '/calendar', route: calendarRoutes },
    { path: '/room-bookings', route: roomBookingRoutes },
    { path: '/approvals', route: approvalRoutes },
];

apiRoutes.forEach(item => {
    if (!item.route) {
        console.warn('Skipping mount for', item.path, '- route module not available');
        return;
    }
    try {
        router.use(item.path, item.route);
    } catch (e) {
        console.error('Failed to mount route', item.path, e && (e.stack || e));
    }
});

// mount dev routes only in non-production
if (process.env.NODE_ENV !== 'production') {
    if (devRoutes) {
        try {
            router.use('/dev', devRoutes);
        } catch (e) {
            console.error('Failed to mount /dev routes', e && (e.stack || e));
        }
    } else {
        console.warn('Dev routes not available; skipping /dev mount');
    }
}

module.exports = router;