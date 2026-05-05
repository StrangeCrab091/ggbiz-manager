/**
 * review.model.js - Mongoose Schema cho Review
 *
 * Lưu trữ thông tin đánh giá từ Google Business Profile:
 * - Thông tin người đánh giá
 * - Nội dung và số sao đánh giá
 * - Kết quả phân tích cảm xúc từ AI
 * - Phản hồi tự động từ AI
 * - Trạng thái đã gửi cảnh báo Telegram hay chưa
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    // ID review từ Google Business API
    googleReviewId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // ID địa điểm (location) trên Google Business
    locationId: {
      type: String,
      index: true,
    },

    // Tên người đánh giá
    reviewerName: {
      type: String,
      default: 'Ẩn danh',
    },

    // Số sao đánh giá (1-5)
    rating: {
      type: Number,
      required: [true, 'Rating là bắt buộc'],
      min: 1,
      max: 5,
    },

    // Nội dung bình luận
    reviewText: {
      type: String,
      default: '',
    },

    // Kết quả phân tích cảm xúc từ AI
    sentiment: {
      tag: {
        type: String,
        default: null,
      },
      analysis: {
        type: String,
        default: '',
      },
    },

    // Phân loại vấn đề (AI Tagging) cho Analytics
    category_tag: {
      type: String,
      default: 'Khác',
      index: true,
    },

    // Phản hồi của hệ thống
    replyText: {
      type: String,
      default: '',
    },

    // Phản hồi từ Google
    reply_content: {
      type: String,
      default: '',
    },

    // Thời gian phản hồi trên Google
    replied_at: {
      type: Date,
      default: null,
    },

    // Đánh dấu đã gửi cảnh báo Telegram chưa
    alertSent: {
      type: Boolean,
      default: false,
    },

    // Trạng thái đã theo dõi/đọc thông báo (Notification)
    isRead: {
      type: Boolean,
      default: false,
    },

    // Trạng thái xử lý review
    status: {
      type: String,
      enum: ['Pending', 'Processed', 'Auto-Replied', 'AI-Replied', 'Alert-Sent', 'Reporting'],
      default: 'Pending',
    },

    // Đánh dấu nghi vấn spam (phát hiện bởi AI)
    isSpamFlagged: {
      type: Boolean,
      default: false,
    },

    // Thời gian đánh giá (Google cung cấp)
    createTime: {
      type: Date,
      index: true,
      default: Date.now,
    },
  },
  {
    // Tự động thêm trường createdAt và updatedAt
    timestamps: true,
    // Không đợi lệnh nếu chưa kết nối (giảm thiểu treo 10s)
    bufferCommands: false,
  }
);

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
