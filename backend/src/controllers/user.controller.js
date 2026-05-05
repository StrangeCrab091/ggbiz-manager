const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

// Lấy danh sách user (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo user mới (Admin only)
const createUser = async (req, res) => {
  try {
    const { username, password, role, assignedLocations, managedLocations } = req.body;
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    
    // Đồng bộ với Model: sử dụng managedLocations và role UP_CASE
    const newUser = await User.create({
      username,
      password: hashedPassword,
      role: (role || 'MANAGER').toUpperCase(),
      managedLocations: managedLocations || assignedLocations || []
    });
    
    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cấu hình cập nhật User (managedLocations)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    let { username, password, role, assignedLocations, managedLocations } = req.body;
    
    const updateData = {};
    if (username) updateData.username = username;
    if (role) updateData.role = role.toUpperCase();
    if (managedLocations || assignedLocations) {
      updateData.managedLocations = managedLocations || assignedLocations;
    }
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    const updated = await User.findByIdAndUpdate(id, updateData, { new: true });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách user (Public) phục vụ Mock chọn tài khoản
const getLoginUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'username role managedLocations');
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Xoá user
const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách thống kê KPI của nhân sự
const getUserKPI = async (req, res) => {
  try {
    const users = await User.find({ role: 'MANAGER' });
    
    // Fake KPI deterministic based on string length and char codes
    const kpiData = users.map(u => {
      const seed = u.username.length + (u.username.charCodeAt(0) || 0);
      return {
        _id: u._id,
        username: u.username,
        art: 10 + (seed % 15), // Average Response Time (minutes)
        resolutionRate: 70 + (seed % 30), // % resolved
        totalActivity: 50 + (seed * 3 % 200) // total actions
      };
    });
    
    // Sort by resolutionRate DESC for Leaderboard
    kpiData.sort((a, b) => b.resolutionRate - a.resolutionRate);
    
    res.status(200).json({ success: true, data: kpiData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  getLoginUsers,
  updateUser,
  deleteUser,
  getUserKPI
};
