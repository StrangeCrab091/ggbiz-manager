const express = require('express');
const router = express.Router();
const competitorController = require('../controllers/competitor.controller');

// Tìm kiếm thông tin đối thủ
router.post('/search', competitorController.searchCompetitor);

// Phân tích đối thủ
router.post('/analyze', competitorController.analyzeCompetitor);

// Phân tích Radar
router.post('/radar', competitorController.radarSearch);

module.exports = router;
