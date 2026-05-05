const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

// Thống kê tổng quan (Most active branch, growth, top issue)
router.get('/overall-stats', analyticsController.getOverallStats);

// Dữ liệu biểu đồ xu hướng hàng tháng của 3 chi nhánh
router.get('/monthly-trends', analyticsController.getMonthlyTrends);

// Dữ liệu Top 5 vấn đề khách hàng phàn nàn
router.get('/top-complaints', analyticsController.getTopComplaints);

// Tổng hợp tháng này vs tháng trước + Top 3 vấn đề (dùng trên Dashboard)
router.get('/monthly-comparison', analyticsController.getMonthlyComparison);

// Đề xuất giải pháp bằng AI
router.get('/ai-solution', analyticsController.getAISolution);

// Bảng xếp hạng chi nhánh
router.get('/branch-ranking', analyticsController.getBranchRanking);

// Điểm sức khỏe SEO (GMB Audit)
router.get('/audit', analyticsController.getAuditScore);

module.exports = router;
