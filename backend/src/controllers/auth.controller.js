const authService = require('../services/auth.service');

const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await authService.getUserProfile(req.user.userId);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

module.exports = { login, getMe };
