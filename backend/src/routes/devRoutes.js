const express = require('express');
const router = express.Router();
const devController = require('../controllers/devController');

// Development-only utilities
router.get('/mfa-code', devController.getMfaCodeForUser);

module.exports = router;
