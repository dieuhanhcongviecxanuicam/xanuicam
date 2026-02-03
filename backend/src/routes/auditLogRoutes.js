// ubndxanuicam/backend/src/routes/auditLogRoutes.js
// VERSION 2.0 - NO CHANGES NEEDED, VERIFIED

const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');
const { registerSSE } = require('../utils/auditBroadcaster');

// GET: Lấy danh sách nhật ký có phân trang và bộ lọc (admin only)
router.get('/', verifyToken, hasPermission(['view_audit_log']), auditLogController.getAuditLogs);
// Server-Sent Events stream for real-time updates (admins only)
router.get('/stream', verifyToken, hasPermission(['view_audit_log']), (req, res) => {
	registerSSE(req, res);
});
// Internal notify endpoint (worker can POST here) - allow without permission but protect in production
router.post('/notify', (req, res) => {
	// In production you should restrict this endpoint (shared secret or run worker in same process)
	auditLogController.notifyUpdate(req, res);
});

// Public endpoint for frontend to record audit events (authenticated users)
router.post('/', verifyToken, auditLogController.createAuditEntry);

// Sessions endpoints - require session management permission
router.get('/sessions', verifyToken, hasPermission(['manage_sessions', 'view_audit_log']), auditLogController.getSessions);
router.post('/sessions/:sid/logout', verifyToken, hasPermission(['manage_sessions']), auditLogController.logoutSession);
router.post('/sessions/logout-all', verifyToken, hasPermission(['manage_sessions']), auditLogController.logoutAllSessions);

// GET: Export decrypted CSV (requires finer-grained permission)
router.get('/export-decrypted', hasPermission(['export_audit_decrypted']), auditLogController.exportDecryptedCsv);
// POST: bulk export (xlsx/pdf/csv) for audit logs with password confirmation and quota check
router.post('/export', hasPermission(['export_audit_decrypted']), auditLogController.exportAuditBulk);
// GET: export quota for audit logs (per-account limit)
router.get('/export/quota', auditLogController.exportAuditQuota);

// GET: single audit log by id
router.get('/:id', auditLogController.getAuditLogById);
// GET: export single audit log entry (CSV or JSON)
router.get('/:id/export', hasPermission(['export_audit_decrypted']), auditLogController.exportAuditById);

module.exports = router;