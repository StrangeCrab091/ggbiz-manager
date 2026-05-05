const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const Auth = require('../models/auth.model');

// GET /api/test-google-connection
router.get('/', async (req, res) => {
  try {
    // Lấy credentials từ DB
    const authData = await Auth.findOne({ accountId: 'system' });
    if (!authData || !authData.tokens) {
      return res.status(401).json({ 
        success: false, 
        message: 'Chưa xác thực Google. Vui lòng kết nối tài khoản trước.' 
      });
    }

    // Khởi tạo OAuth2 client với Client ID / Client Secret mới nhất từ .env
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
    );
    oauth2Client.setCredentials(authData.tokens);

    console.log('📡 Đang gọi API lấy Account ID (Account Management API)...');
    
    // Bước 1: Gọi API GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts để lấy Account ID động.
    const accountsRes = await oauth2Client.request({
      url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
    });
    
    if (!accountsRes.data.accounts || accountsRes.data.accounts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy Google Business Account nào liên kết với phiên đăng nhập này.' 
      });
    }
    
    const accountId = accountsRes.data.accounts[0].name;
    console.log(`✅ Đã lấy thành công Account ID: ${accountId}`);

    // Bước 2: Sử dụng Account ID vừa lấy được, gọi tiếp API để kéo danh sách chi nhánh.
    const locationsUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title`;
    console.log(`📡 Đang gọi API lấy Locations: ${locationsUrl}`);
    
    const locationsRes = await oauth2Client.request({ url: locationsUrl });
    const locations = locationsRes.data.locations || [];
    console.log(`✅ Đã lấy được ${locations.length} chi nhánh.`);

    // Bước 3: Trả kết quả về mảng các locationName và title
    const formattedLocations = locations.map(loc => ({
      locationName: loc.name,
      title: loc.title
    }));

    return res.json({
      success: true,
      message: `Kết nối n8n-MBC thành công: Đã tìm thấy ${formattedLocations.length} chi nhánh.`,
      accountId: accountId,
      data: formattedLocations
    });

  } catch (error) {
    console.error('🔥 [TEST CONNECTION ERROR]', error.response?.status || '', error.message);
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    return res.status(error.response?.status || 500).json({
      success: false,
      message: 'Lỗi khi kết nối API Google Business',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

module.exports = router;
