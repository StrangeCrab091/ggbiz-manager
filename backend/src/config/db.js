/**
 * db.js - Cấu hình kết nối MongoDB
 *
 * Sử dụng Mongoose để kết nối đến MongoDB.
 * Hàm connectDB() được gọi trong server.js trước khi khởi động Express.
 */

const mongoose = require('mongoose');
const dns = require('dns');

/**
 * Kết nối đến MongoDB
 * @returns {Promise<void>}
 */
const connectDB = () => {
  const mongoURI = process.env.MONGO_URI;
  
  // Khắc phục lỗi querySrv ECONNREFUSED trên một số hệ thống DNS
  dns.setServers(['8.8.8.8', '8.8.4.4']);
  
  console.log('⏳ Đang kết nối MongoDB...');
  return mongoose.connect(mongoURI, {
    bufferCommands: false, // Không đợi lệnh nếu chưa kết nối (fail fast)
  });
};

module.exports = connectDB;
