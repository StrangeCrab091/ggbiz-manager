/**
 * server.js - Điểm khởi chạy chính của ứng dụng
 *
 * Nhiệm vụ:
 * 1. Nạp biến môi trường từ file .env
 * 2. Kết nối đến MongoDB
 * 3. Khởi động Express server trên port được cấu hình
 */

const dotenv = require('dotenv');

// Nạp biến môi trường trước khi import các module khác
dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { startAutomationService } = require('./src/services/automation.service');

// Lấy PORT từ biến môi trường, mặc định là 5000
const PORT = process.env.PORT || 5000;

/**
 * Hàm khởi động server
 * - Kết nối database trước
 * - Sau đó mới lắng nghe request
 */
const startServer = () => {
  // Bước 1: Kết nối MongoDB
  connectDB()
    .then((conn) => {
      console.log(`✅ MongoDB đã kết nối thành công: ${conn.connection.host}`);
      // Bước 2: Chỉ khởi động Express server KHI VÀ CHỈ KHI kết nối DB thành công
      const HOST = '0.0.0.0';
      app.listen(PORT, HOST, () => {
        console.log(`🚀 Server đang chạy tại http://${HOST}:${PORT}`);
        console.log(`📦 Môi trường: ${process.env.NODE_ENV || 'development'}`);
        
        // Kích hoạt Automation Service (thay thế AutoPilot Worker cũ)
        startAutomationService();
      });
    })
    .catch((error) => {
      console.error(`❌ Lỗi kết nối MongoDB nghiêm trọng: ${error.message}`);
      console.error('👉 Vui lòng kiểm tra:');
      console.error('   1. Hệ thống đã cho phép IP của bạn truy cập (Atlas Allowlist) chưa?');
      console.error('   2. URI trong file .env có đúng không?');
      console.error('🚨 HỆ THỐNG ĐÃ DỪNG LẠI để đảm bảo an toàn dữ liệu.');
      process.exit(1);
    });
};

// Khởi chạy server
startServer();

