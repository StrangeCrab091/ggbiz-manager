/**
 * app.js - Cấu hình Express Application
 *
 * Nhiệm vụ:
 * 1. Khởi tạo Express app
 * 2. Đăng ký các middleware cơ bản (CORS, JSON parser, URL-encoded)
 * 3. Mount các routes từ router trung tâm
 * 4. Middleware xử lý lỗi toàn cục
 */

const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// ===== MIDDLEWARE CƠ BẢN =====

// Cho phép Cross-Origin Resource Sharing (giao tiếp giữa frontend và backend khác domain)
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
};
app.use(cors(corsOptions));
app.options(/(.*)/,  cors(corsOptions)); // Pre-flight requests (Express 5 compatible)

// Phân tích request body dạng JSON
app.use(express.json({ limit: '10mb' }));

// Phân tích request body dạng URL-encoded (form data)
app.use(express.urlencoded({ extended: true }));

// ===== HEALTH CHECK ENDPOINT =====
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server đang hoạt động bình thường',
    timestamp: new Date().toISOString(),
  });
});

// ===== ĐĂNG KÝ ROUTES =====
app.use('/api', routes);

// ===== MIDDLEWARE XỬ LÝ ROUTE KHÔNG TỒN TẠI =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy route: ${req.method} ${req.originalUrl}`,
  });
});

// ===== MIDDLEWARE XỬ LÝ LỖI TOÀN CỤC =====
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ Lỗi server:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Lỗi server nội bộ',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
