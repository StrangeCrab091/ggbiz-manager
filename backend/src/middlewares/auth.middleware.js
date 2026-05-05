const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // NẾU KHÔNG CÓ JWT, THỬ FALLBACK VỀ MOCK AUTH CŨ (x-user-id) CHO FE CHƯA CÓ LOGIN TRANG
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          req.user = { userId: user._id, role: user.role, managedLocations: user.managedLocations || [] };
          return next();
        }
      } catch (e) {
        // Fallback catch
      }
    }
    return res.status(401).json({ success: false, message: 'Chưa cung cấp token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded; // { userId, role, managedLocations }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }
    
    const userRoleLower = req.user.role.toLowerCase();
    const allowedRolesLower = roles.map(r => r.toLowerCase());
    
    if (!allowedRolesLower.includes(userRoleLower)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  authenticate: verifyToken, // backward compatibility
  authorizeRoles
};
