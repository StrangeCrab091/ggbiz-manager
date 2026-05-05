const axios = require('axios');

/**
 * Gửi thông báo review tiêu cực qua Microsoft Teams Webhook.
 * Payload sử dụng Adaptive Card để hiển thị giao diện đẹp và rõ ràng.
 */
const sendTeamsAlert = async (data) => {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return { success: false, message: 'Thiếu cấu hình TEAMS_WEBHOOK_URL' };

  try {
    const { rating, reviewerName, comment, locationName } = data;

    const starString = '⭐'.repeat(rating || 1);
    const name = reviewerName || 'Khách hàng ẩn danh';
    const content = comment || 'Không có nội dung';
    const loc = locationName || 'Không xác định';

    const payload = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.2",
            body: [
              {
                type: "TextBlock",
                text: "🚨 REVIEW TIÊU CỰC CẦN XỬ LÝ",
                weight: "Bolder",
                size: "Medium",
                color: "Attention"
              },
              {
                type: "FactSet",
                facts: [
                  { title: "Chi nhánh:", value: loc },
                  { title: "Đánh giá:", value: `${rating} ${starString}` },
                  { title: "Khách hàng:", value: name },
                  { title: "Nội dung:", value: content }
                ]
              },
              {
                type: "TextBlock",
                text: "Hãy vào MapManager hoặc kiểm tra Telegram để xử lý ngay!",
                wrap: true,
                color: "Warning",
                weight: "Bolder",
                spacing: "Medium"
              }
            ]
          }
        }
      ]
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`📢 [Teams] Đã gửi alert cho [${name}]`);
    return { success: true };
  } catch (error) {
    console.error('❌ Lỗi gửi Teams alert:', error.message);
    return { success: false, message: error.message };
  }
};

module.exports = {
  sendTeamsAlert
};
