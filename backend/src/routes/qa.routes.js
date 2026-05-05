const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qa.controller');
// Danh sách các endpoints
router.get('/', qaController.getQuestions);
router.post('/suggest', qaController.suggestAnswer);
router.post('/answer', qaController.answerQuestion);

module.exports = router;
