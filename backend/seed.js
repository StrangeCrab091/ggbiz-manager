require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/user.model');

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('🔗 Đã kết nối DB để seed dữ liệu...');

    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Xóa admin cũ để đảm bảo không bị cache hoặc sai lệch DB
    await User.deleteMany({ username: 'admin' });
    
    await User.create({
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN',
      managedLocations: []
    });
    console.log('✅ Đã tạo MỚI tài khoản mặc định: admin / admin123');

    // TẠO THÊM admin2 ĐỂ DEBUG
    await User.deleteMany({ username: 'admin2' });
    await User.create({
      username: 'admin2',
      password: hashedPassword,
      role: 'ADMIN',
      managedLocations: []
    });
    console.log('✅ Đã tạo tài khoản phụ: admin2 / admin123');
    
    mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối DB.');
  })
  .catch((err) => {
    console.error('❌ Lỗi kết nối DB:', err);
    process.exit(1);
  });
