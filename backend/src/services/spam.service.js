const { GoogleGenerativeAI } = require('@google/generative-ai');
const SpamAlert = require('../models/spamAlert.model');
const Review = require('../models/review.model');
const axios = require('axios');

/**
 * detectSpamPatterns - Phân tích các review mới để phát hiện tấn công bẩn
 * 
 * @param {string} locationId - ID chi nhánh cần kiểm tra
 * @param {Array} newReviews - Danh sách các review vừa mới kéo về/nhận được
 */
const detectSpamPatterns = async (locationId, newReviews) => {
  try {
    // 1. Kiểm tra mật độ (Density Check)
    // Ngưỡng spam: Ví dụ > 3 review 1-2 sao trong vòng 1 giờ
    const SPAM_THRESHOLD = 3; 
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Lấy thêm các review 1-2 sao trong DB của 1 giờ qua
    const recentLowRatedInDb = await Review.find({
      locationId,
      rating: { $lte: 2 },
      createTime: { $gte: oneHourAgo }
    });

    const currentLowRated = newReviews.filter(r => r.rating <= 2 || r.starRating <= 2);
    const totalPotentialSpam = [...recentLowRatedInDb, ...currentLowRated];

    console.log(`🛡️ [SpamCheck] Phát hiện ${totalPotentialSpam.length} review thấp điểm trong 1 giờ qua.`);

    if (totalPotentialSpam.length < SPAM_THRESHOLD) {
      return { isSpam: false };
    }

    // 2. Phân tích nội dung (AI Analysis)
    console.log('🤖 AI đang phân tích dấu hiệu spam/tấn công bẩn...');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const reviewListForAi = totalPotentialSpam.map(r => 
      `- Tên: ${r.reviewerName || r.reviewer?.displayName}, Sao: ${r.rating || r.starRating}, Nội dung: "${r.reviewText || r.comment || '(trống)'}"`
    ).join('\n');

    const prompt = `Hãy đóng vai trò chuyên gia an ninh mạng. Hãy phân tích danh sách các đánh giá Google Maps dưới đây. 
Nếu thấy có dấu hiệu dùng clone để spam (ví dụ: các tài khoản tên lạ, cùng thời điểm, nội dung trùng lặp, hoặc không có nội dung, hoặc nội dung mang tính chất hạ bệ ác ý vô căn cứ), hãy trả về một JSON gồm:
1. isSpam: true/false
2. reason: Giải thích ngắn gọn lý do vì sao tin là spam.
3. confidence: Độ tin cậy (0-1).

Chỉ trả về JSON thuần, không markdown.

DANH SÁCH REVIEW:
${reviewListForAi}`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    // Clean JSON
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json\n/g, '').replace(/\n```/g, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```/g, '');
    }

    const aiAnalysis = JSON.parse(responseText);

    if (aiAnalysis.isSpam) {
      console.warn('🚨 [CRITICAL] Phát hiện tấn công Spam 1 sao!');
      
      // Đánh dấu các review này trong DB là nghi vấn spam
      const reviewIds = totalPotentialSpam.map(r => r.googleReviewId || r._id);
      await Review.updateMany(
        { googleReviewId: { $in: reviewIds } },
        { isSpamFlagged: true }
      );

      // Lưu cảnh báo vào DB
      const alert = await SpamAlert.create({
        locationId,
        count: totalPotentialSpam.length,
        reviews: totalPotentialSpam.map(r => ({
          reviewId: r.googleReviewId || r.reviewId,
          reviewerName: r.reviewerName || r.reviewer?.displayName,
          rating: r.rating || r.starRating,
          reviewText: r.reviewText || r.comment,
          createTime: r.createTime
        })),
        reason: aiAnalysis.reason
      });

      // Gửi Telegram Khẩn cấp
      await sendEmergencyTelegram(locationId, totalPotentialSpam.length, aiAnalysis.reason);
      
      return { isSpam: true, alert };
    }

    return { isSpam: false };
  } catch (error) {
    console.error('❌ Lỗi detectSpamPatterns:', error.message);
    return { isSpam: false, error: error.message };
  }
};

/**
 * sendEmergencyTelegram - Gửi tin nhắn khẩn cấp
 */
const sendEmergencyTelegram = async (locationId, count, reason) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const message = `🚨 <b>CẢNH BÁO KHẨN CẤP: ANTI-SABOTAGE</b> 🚨\n\n` +
    `Doanh nghiệp của bạn tại chi nhánh <b>${locationId}</b> đang có dấu hiệu bị đối thủ chơi xấu/spam 1 sao.\n\n` +
    `● <b>Số lượng:</b> ${count} review nghi vấn/giờ\n` +
    `● <b>Phân tích AI:</b> ${reason}\n\n` +
    `👉 <i>Hãy vào hệ thống MapManager để kiểm tra và báo cáo Google ngay!</i>`;

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  } catch (e) {
    console.error('Lỗi gửi Telegram Khẩn cấp:', e.message);
  }
};

module.exports = {
  detectSpamPatterns
};
