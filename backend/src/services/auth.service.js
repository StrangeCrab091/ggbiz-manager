const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

const login = async ({ username, password }) => {
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Tài khoản không tồn tại');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Mật khẩu không đúng');
  }

  const payload = {
    userId: user._id,
    username: user.username,
    role: user.role,
    managedLocations: user.managedLocations || []
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET || 'mapmanager_secret', { expiresIn: '24h' });

  return { token, user: payload };
};

const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

module.exports = { login, getUserProfile };
