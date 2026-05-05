const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');

// Lấy danh sách chi nhánh
router.get('/', locationController.getLocations);

// Lấy chỉ số hiệu suất của chi nhánh (30 ngày)
router.get('/performance', locationController.getPerformance);

// Quét lưới Local Search Grid
router.post('/scan-grid', locationController.scanGrid);

module.exports = router;
