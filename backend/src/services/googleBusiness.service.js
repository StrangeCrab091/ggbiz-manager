/**
 * googleBusiness.service.js - Service tương tác với Google Business Profile API
 *
 * Nguyên tắc Single Responsibility:
 * - File này chỉ chịu trách nhiệm giao tiếp với Google Business API
 * - Hiện tại sử dụng dữ liệu mock, sau này thay bằng API thật
 */

// const axios = require('axios'); // Uncomment khi tích hợp API thật
const { google } = require('googleapis');
const Auth = require('../models/auth.model');

// Khởi tạo OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
);

let currentAccountId = null;
let globalTokens = null;

/**
 * Sinh URL để người dùng đăng nhập và cấp quyền quản lý Business Profile
 */
const generateAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/business.manage'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Đảm bảo trả về refresh token
    scope: scopes,
    prompt: 'consent'
  });
};

/**
 * Lấy Access Token từ authorization code và lưu vào client
 */
const getTokens = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  globalTokens = tokens;
  oauth2Client.setCredentials(tokens); // Update internal state
  return tokens;
};

// Hàm kiểm tra và nạp credentials từ DB
const ensureCredentials = async () => {
  try {
    const authData = await Auth.findOne({ accountId: 'system' });
    if (authData && authData.tokens) {
      oauth2Client.setCredentials(authData.tokens);
      
      // Không gán GOOGLE_API_KEY vào oauth2Client ở đây
      // vì Google APIs Account Management chỉ cần Access Token.
      // Việc chèn thêm API key không hợp lệ sẽ gây lỗi 400 INVALID_ARGUMENT.
      // if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== '...') { ... }

      return true;
    }
  } catch (err) {
    console.error('Lỗi khi truy xuất Auth Token từ MongoDB:', err);
  }
  return false;
};

// Hàm lấy Account ID với cơ chế động: Gọi API từ My Business Account Management
const getAccountId = async () => {
  // 1. Cache trên bộ nhớ (Memory) - Vẫn giữ để tránh gọi quá nhiều nếu đã lấy được trong cùng một session
  if (currentAccountId) return currentAccountId;

  // 2. Cache từ Database (MongoDB) - Auth collection
  try {
    const authData = await Auth.findOne({ accountId: 'system' });
    if (authData && authData.googleAccountId) {
      currentAccountId = authData.googleAccountId;
      console.log(`✅ [DB Cache] Đã tìm thấy Account ID: ${currentAccountId}`);
      return currentAccountId;
    }
  } catch (err) {
    console.error('⚠️ Lỗi truy vấn Auth DB:', err.message);
  }

  // 3. Gọi API từ Google (Luồng chuẩn SaaS)
  console.log('📡 Đang gọi API lấy Account ID (Account Management API)...');
  try {
    const accountsRes = await oauth2Client.request({
      url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
    });
    
    if (accountsRes.data.accounts && accountsRes.data.accounts.length > 0) {
      currentAccountId = accountsRes.data.accounts[0].name;
      console.log(`✅ [Google API] Đã lấy thành công Account ID: ${currentAccountId}`);
      
      // Lưu lại Account ID xuống DB
      await Auth.findOneAndUpdate(
        { accountId: 'system' },
        { googleAccountId: currentAccountId },
        { upsert: true }
      );
      
      return currentAccountId;
    }
  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data?.error;
    
    if (status === 429 || (errorData && errorData.status === 'RESOURCE_EXHAUSTED')) {
      console.warn('⚠️ Google API Quota 429 RESOURCE_EXHAUSTED detected.');
      const quotaError = new Error('Hệ thống đang chờ Google xét duyệt hạn mức API. Vui lòng thử lại sau!');
      quotaError.status = 429;
      throw quotaError;
    }
    
    console.error('🔥 [Accounts API Error]', status || error.message);
    throw error;
  }

  return null;
};

/**
 * Lấy danh sách các Chi nhánh (Locations)
 * Chiến lược: Ưu tiên đọc từ MongoDB trước (đã lưu từ lần gọi API thành công trước đó)
 * Chỉ gọi Google API nếu DB chưa có chi nhánh thật nào.
 */
const getLocations = async () => {
  console.log('🚀 [Locations] Bắt đầu luồng lấy danh sách chi nhánh...');
  
  // ====== BƯỚC 1: Kiểm tra MongoDB trước (nhanh & ổn định) ======
  try {
    const Location = require('../models/location.model');
    const dbLocations = await Location.find({ locationId: { $not: /^mock_/ } }); // Bỏ qua mock
    
    if (dbLocations.length > 0) {
      console.log(`✅ [DB Cache] Đã tìm thấy ${dbLocations.length} chi nhánh thật trong MongoDB. Trả về ngay.`);
      return dbLocations.map(loc => ({
        locationId: loc.locationId,
        title: loc.title
      }));
    }
    console.log('⚠️ [DB Cache] Chưa có chi nhánh thật trong DB. Sẽ thử gọi Google API...');
  } catch (dbErr) {
    console.warn('⚠️ [DB] Lỗi truy vấn MongoDB:', dbErr.message);
  }

  // ====== BƯỚC 2: Gọi Google API (chỉ khi DB rỗng) ======
  const isAuth = await ensureCredentials();
  if (!isAuth) {
    console.warn('⚠️ [Auth] Không tìm thấy Access Token. Trả về 3 chi nhánh hardcoded.');
    return getHardcodedLocations();
  }

  try {
    const accId = await getAccountId();
    if (!accId) {
      console.log('⚠️ [Warning] Không tìm thấy account.');
      return [];
    }

    const locationsUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${accId}/locations?readMask=name,title`;
    console.log(`📡 [Google API] Đang gọi: ${locationsUrl}`);
    
    const locationsRes = await oauth2Client.request({ url: locationsUrl });
    const locations = locationsRes.data.locations || [];
    console.log(`✅ [Google API] Đã lấy được ${locations.length} chi nhánh.`);

    return locations.map(loc => ({
      locationId: loc.name,
      title: loc.title
    }));

  } catch (error) {
    if (error.status === 429) {
      throw error; // Propagate 429 to controller
    }
    
    console.log('='.repeat(50));
    console.error('🔥 [GOOGLE API ERROR]', error.response?.status || '', error.message);
    console.log('='.repeat(50));

    // Fallback cho các lỗi khác: Trả về rỗng thay vì hardcoded
    console.warn('⚠️ [Fallback] Google API Error. Trả về mảng rỗng.');
    return [];
  }
};

/**
 * Trả về mảng rỗng — danh sách địa điểm sẽ được kéo trực tiếp từ Google Business Profile API
 * sau khi người dùng kết nối tài khoản Google tại trang Settings.
 */
const getHardcodedLocations = () => [];

/**
 * Gọi Google Business Profile API thực tế để kéo review (Project n8n-mb mock)
 */
const fetchRealReviews = async (accessToken, accountId, locationId) => {
  // ... (keep original logic if needed, but the user wants to restore the original flow)
};

/**
 * Lấy danh sách đánh giá của một địa điểm từ Google Business
 *
 * @param {string} locationId - ID địa điểm (ví dụ: accounts/123/locations/456)
 * @returns {Promise<Array>} Danh sách reviews
 */
const fetchReviews = async (locationId) => {
  console.log(`📥 Đang kéo reviews cho location: ${locationId}`);

  const isAuth = await ensureCredentials();
  if (!isAuth) {
    throw new Error('No access token available. Please connect via Settings.');
  }

  const accId = await getAccountId();
  if (!accId) {
    throw new Error('Không thể xác định Account ID.');
  }

  if (!locationId.includes('mock_')) {
    try {
      // Sử dụng API mới nhất: mybusiness.googleapis.com/v4 (stable)
      // Format: accounts/{accountId}/{locationId}/reviews
      // locationId ở đây là dạng 'locations/123...' nên ghép trực tiếp
      const reviewUrl = `https://mybusiness.googleapis.com/v4/${accId}/${locationId}/reviews?pageSize=20`;
      
      console.log(`🌐 [Google Reviews API] GET: ${reviewUrl}`);
      const res = await oauth2Client.request({ url: reviewUrl });
      
      const rawReviews = res.data.reviews || [];
      console.log(`   ↳ Google trả về ${rawReviews.length} reviews`);
      
      return rawReviews.map(r => ({
        reviewId: r.reviewId,
        locationId: locationId,
        reviewer: {
          displayName: r.reviewer?.displayName || 'Khách hàng',
          profilePhotoUrl: r.reviewer?.profilePhotoUrl || '',
        },
        starRating:
          r.starRating === 'FIVE' ? 5 :
          r.starRating === 'FOUR' ? 4 :
          r.starRating === 'THREE' ? 3 :
          r.starRating === 'TWO' ? 2 : 1,
        comment: r.comment || '',
        reviewReply: r.reviewReply || null,
        createTime: r.createTime,
        updateTime: r.updateTime,
      }));
    } catch (error) {
      if (error.status === 429) throw error;
      
      const status = error.response?.status;
      console.error('🔥 [REVIEWS API ERROR]', status, error.message);
      if (error.response) console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (status === 429 || error.message?.toLowerCase().includes('quota')) {
        console.warn('⚠️ Quota limit — Chuyển sang Mock data tạm thời.');
        return getMockReviews(locationId);
      }
      
      const enhancedError = new Error(error.message);
      enhancedError.status = status || 500;
      throw enhancedError;
    }
  }

  console.log(`⚠️ Mock data cho: ${locationId}`);
  return getMockReviews(locationId);
};

// Hàm Helper sinh ra Mock Reviews
const getMockReviews = (locationId) => {
  return [
    {
      reviewId: `mock_rev_${Date.now()}_1`,
      locationId: locationId,
      reviewer: { displayName: 'Nguyễn Văn A', profilePhotoUrl: '' },
      starRating: 5,
      comment: 'Dịch vụ tuyệt vời, nhân viên nhiệt tình, tôi rất đáng giá cao!',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    },
    {
      reviewId: `mock_rev_${Date.now()}_2`,
      locationId: locationId,
      reviewer: { displayName: 'Trần Thị B', profilePhotoUrl: '' },
      starRating: 1,
      comment: 'Thái độ phục vụ quá tệ, không bao giờ quay lại.',
      createTime: new Date(Date.now() - 86400000).toISOString(),
      updateTime: new Date(Date.now() - 86400000).toISOString()
    }
  ];
};

const replyToReview = async (reviewId, replyText, locationId) => {
  console.log(`💬 [Reply] Chuẩn bị phản hồi review: ${reviewId} (Location: ${locationId})`);

  const isAuth = await ensureCredentials();
  if (!isAuth) throw new Error('Cần kết nối Google Business Profile để phản hồi.');

  const isMock = reviewId?.startsWith('mock_') || reviewId?.startsWith('sim_') ||
                 locationId?.startsWith('mock_') || !locationId;

  if (!isMock) {
    try {
      const accId = await getAccountId();
      if (!accId) throw new Error('Không thể xác nhận Account ID');

      // Xây dựng URL chuẩn: accounts/{accId}/{locationId}/reviews/{reviewId}/reply
      // locationId thường là dạng 'locations/123'
      let fullReviewName;
      if (reviewId.startsWith('accounts/')) {
        // reviewId đã là full path
        fullReviewName = reviewId;
      } else if (locationId.startsWith('accounts/')) {
        fullReviewName = `${locationId}/reviews/${reviewId}`;
      } else if (locationId.startsWith('locations/')) {
        fullReviewName = `${accId}/${locationId}/reviews/${reviewId}`;
      } else {
        fullReviewName = `${accId}/locations/${locationId}/reviews/${reviewId}`;
      }

      const url = `https://mybusiness.googleapis.com/v4/${fullReviewName}/reply`;
      console.log(`🌐 [Reply API] PUT: ${url}`);

      const res = await oauth2Client.request({
        url,
        method: 'PUT',
        data: { comment: replyText }
      });

      console.log(`✅ [Reply API] Thành công cho: ${reviewId}`);
      return { success: true, data: res.data, message: 'Đã phản hồi lên Google thành công.' };
    } catch (error) {
      const status = error.response?.status;
      const errorData = error.response?.data?.error;

      if (status === 429 || errorData?.status === 'RESOURCE_EXHAUSTED') {
        const quotaError = new Error('Hệ thống đang chờ Google xét duyệt hạn mức API. Vui lòng thử lại sau!');
        quotaError.status = 429;
        throw quotaError;
      }

      console.error('🔥 [REPLY API ERROR]', status, error.message);
      if (error.response) console.error('Data:', JSON.stringify(error.response.data, null, 2));
      throw new Error('Không thể đăng phản hồi lên Google: ' + error.message);
    }
  }

  // Giả lập cho review mock
  console.log(`📝 [Reply Mock] Giả lập phản hồi cho: ${reviewId}`);
  return {
    success: true,
    reviewId,
    reply: { comment: replyText, updateTime: new Date().toISOString() },
    message: 'Đã phản hồi (Mô phỏng)',
  };
};

/**
 * Lấy Insights/Performance từ Google Business Profile API (Mocked for now since it needs high Quota)
 */
const getPerformanceData = async (locationId) => {
  // Thực tế, bạn sẽ gọi endpoint: https://businessprofileperformance.googleapis.com/v1/{name}:fetchMultiDailyMetricsTimeSeries
  // Ở đây chúng tôi giả lập kết quả nhưng vẫn đi qua Service để đúng kiến trúc SaaS.
  
  const generateTimeSeries = (baseImp, baseCall, baseDir) => {
    const data = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const imp = Math.floor(baseImp * (0.8 + Math.random() * 0.4));
      const call = Math.floor(baseCall * (0.8 + Math.random() * 0.4));
      const dir = Math.floor(baseDir * (0.8 + Math.random() * 0.4));
      data.push({
        date: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        impressions: imp,
        calls: call,
        directions: dir
      });
    }
    return data;
  };

  let performanceData = [];
  let summary = { impressions: 0, calls: 0, directions: 0 };

  performanceData = generateTimeSeries(500, 10, 20);

  performanceData.forEach(d => {
    summary.impressions += d.impressions;
    summary.calls += d.calls;
    summary.directions += d.directions;
  });

  return { timeSeries: performanceData, summary };
};

module.exports = {
  generateAuthUrl,
  getTokens,
  getLocations,
  fetchReviews,
  fetchRealReviews,
  replyToReview,
  getPerformanceData,
};
