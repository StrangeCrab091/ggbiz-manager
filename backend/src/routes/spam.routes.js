const express = require('express');
const router = express.Router();
const spamController = require('../controllers/spam.controller');
router.get('/alerts', spamController.getActiveAlerts);
router.put('/alerts/:id/resolve', spamController.resolveAlert);
router.put('/report-review/:id', spamController.handleReportReview);
router.post('/dispute-draft', spamController.handleGetDisputeDraft);

module.exports = router;
