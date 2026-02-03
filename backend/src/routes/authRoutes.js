// ubndxanuicam/backend/src/routes/authRoutes.js
// VERSION 2.0 - VERIFIED AND FINALIZED

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { validatePasswordChange, validate } = require('../middlewares/validationMiddleware');
const { avatarUpload } = require('../middlewares/uploadMiddleware');

// POST: Đăng nhập (Public)
router.post('/login', authController.login);

// Allow a user (pre-login) to invalidate other active sessions by providing credentials
router.post('/sessions/logout-others', authController.logoutOtherDevices);
// Allow a user (pre-login) to list active sessions for their account (credential-verified)
router.post('/sessions/list', authController.listSessionsByCredentials);
// Allow a user (pre-login) to logout a specific session by providing credentials
router.post('/sessions/:sid/logout-credential', authController.logoutSessionWithCredentials);

// MFA endpoints (require authentication)
router.post('/mfa/setup', verifyToken, authController.mfaSetup);
router.post('/mfa/verify', verifyToken, authController.mfaVerify);
router.post('/mfa/disable', verifyToken, authController.mfaDisable);
router.get('/mfa/info', verifyToken, authController.mfaInfo);
// Server-side QR image generation to avoid CORS/redirects
router.get('/mfa/qr', verifyToken, authController.mfaQR);
// Session export (JSON/CSV) for admins/owners
router.get('/sessions/:sid/export', verifyToken, authController.exportSession);
router.post('/mfa/rotate', verifyToken, authController.mfaRotate);
// Dev helper: allow requesting a dev-only fallback code when user can't access authenticator
router.post('/mfa/fallback-request', authController.mfaFallbackRequest);
router.post('/sessions/:sid/logout', verifyToken, authController.logoutOwnSession);

// PUT: Cập nhật hồ sơ (Private)
router.put('/profile', verifyToken, avatarUpload.single('avatar'), authController.updateProfile);

// POST: Đổi mật khẩu (Private)
router.post('/change-password', verifyToken, validatePasswordChange, validate, authController.changePassword);

module.exports = router;