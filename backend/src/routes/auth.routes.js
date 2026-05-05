const express = require('express');
const router = express.Router();
const googleService = require('../services/googleBusiness.service');
const Auth = require('../models/auth.model');
const authController = require('../controllers/auth.controller');
// Google OAuth callback (dùng để kết nối tài khoản Google Business)

// GET /api/auth/google
// Lấy link Authorization URL từ Google và redirect người dùng tới trang cấp quyền
router.get('/google', (req, res) => {
  try {
    const authUrl = googleService.generateAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('Lỗi sinh authUrl:', error);
    res.status(500).json({ success: false, message: 'Google OAuth generation failed' });
  }
});

// GET /api/auth/google/callback
// Người dùng sau khi cấp quyền tại Google sẽ bị redirect về đây với tham số "code"
router.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Thiếu mã code authorization!');
    }

    // Lấy tokens
    const tokens = await googleService.getTokens(code);
    
    // Lưu token vào MongoDB
    await Auth.findOneAndUpdate(
      { accountId: 'system' },
      { tokens: tokens },
      { upsert: true, new: true }
    );
    
    console.log('✅ Đã nhận được Refresh Token / Access Token và lưu vào DB.');
    
    // Redirect về Frontend Settings Page và mang theo 1 tham số success
    // Đã cố định port frontend là 5173
    res.redirect('http://localhost:5173/settings?auth=success');
  } catch (error) {
    console.log('\n' + '='.repeat(50));
    console.error('🔥 [OAUTH CALLBACK ERROR] 🔥');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Stack:', error.stack);
    }
    console.log('='.repeat(50) + '\n');
    res.status(500).send(`OAuth callback failed! Error: ${error.message}`);
  }
});

module.exports = router;
