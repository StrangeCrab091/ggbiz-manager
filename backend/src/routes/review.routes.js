/**
 * review.routes.js - Định nghĩa các endpoint RESTful cho Review
 *
 * Các endpoint:
 * - GET  /api/reviews          → Lấy danh sách đánh giá
 * - POST /api/reviews/process  → Xử lý review mới (phân tích + cảnh báo + lưu DB)
 */

const express = require('express');

const router = express.Router();
const reviewController = require('../controllers/review.controller');

// Lấy thông số thống kê review cho Dashboard
router.get('/stats', reviewController.getReviewStats);

// Thông báo review tiêu cực chưa đọc
router.get('/notifications', reviewController.getUnreadNotifications);
router.put('/notifications/:id/read', reviewController.markNotificationAsRead);

// Xuất báo cáo Excel
router.get('/export', reviewController.exportReviews);

// Lấy danh sách reviews theo locationId
router.get('/', reviewController.getReviews);

// Lấy AI Insights từ list review (dùng filter giống GET /)
router.get('/insights', reviewController.getReviewInsights);

// Xử lý review mới: phân tích cảm xúc → cảnh báo nếu tiêu cực → lưu DB
// Body: { locationId, googleReviewId, reviewerName, rating, comment }
router.post('/process', reviewController.processNewReview);

// Gọi AI tạo gợi ý trả lời
// Body: { comment, rating }
router.post('/generate-reply', reviewController.generateReplyFromAI);

// Xác nhận gửi phản hồi: Lưu DB + Đẩy lên Google Maps
// Body: { reviewId, replyText }
router.post('/submit-reply', reviewController.submitReply);

// Tuyến đường test cảnh báo Telegram
router.post('/test-alert', reviewController.testTelegramAlert);

// Đồng bộ review từ Google Business
router.post('/sync', reviewController.syncReviews);

// Giả lập review tiêu cực để test automation
router.post('/simulate', reviewController.simulateReview);

module.exports = router;
