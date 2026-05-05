/**
 * telegram.service.js — Telegram Bot Service nâng cao
 *
 * Chức năng:
 *  1. Gửi cảnh báo review tiêu cực kèm Draft AI + Inline Keyboard
 *  2. Chỉnh sửa tin nhắn sau khi xử lý (editMessageText)
 *  3. Gửi phản hồi xác nhận (answerCallbackQuery)
 */

const axios = require('axios');

const getBotConfig = () => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  return {
    botToken,
    chatId,
    apiBase: `https://api.telegram.org/bot${botToken}`,
  };
};

/**
 * Gửi cảnh báo review tiêu cực kèm AI Draft + 2 nút Inline
 *
 * @param {Object} data
 *   - rating, reviewerName, comment, locationName, category
 *   - reviewDbId: MongoDB _id (để gắn vào callback_data)
 *   - aiDraftReply: câu trả lời AI đề xuất (nếu có)
 */
const sendAlertWithDraft = async (data) => {
  const cfg = getBotConfig();
  if (!cfg) {
    console.warn('⚠️ Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID');
    return { success: false, message: 'Thiếu cấu hình Telegram Bot' };
  }

  try {
    const {
      rating, reviewerName, comment,
      locationName, category,
      reviewDbId, aiDraftReply,
    } = data;

    const starString = '⭐'.repeat(rating || 1);
    const name = reviewerName || 'Khách hàng ẩn danh';
    const content = comment || 'Không có nội dung';
    const locLine = locationName ? `\n📍 <b>Chi nhánh:</b> ${locationName}` : '';
    const catLine = category ? `\n🏷️ <b>Phân loại:</b> ${category}` : '';

    // AI Draft section
    const draftSection = aiDraftReply
      ? `\n\n🤖 <b>AI đề xuất trả lời:</b>\n<i>"${aiDraftReply}"</i>`
      : '\n\n⚠️ <i>Không thể tạo bản nháp AI.</i>';

    const message = [
      `🚨 <b>REVIEW TIÊU CỰC CẦN XỬ LÝ</b> 🚨`,
      ``,
      `⭐ <b>Đánh giá:</b> ${starString} (${rating || 1} sao)${locLine}`,
      `👤 <b>Khách hàng:</b> ${name}${catLine}`,
      `💬 <b>Nội dung:</b> ${content}`,
      draftSection,
      ``,
      `<i>👇 Chọn hành động bên dưới hoặc Reply tin nhắn này để tự viết phản hồi:</i>`,
    ].join('\n');

    // Inline Keyboard: 2 nút
    const inline_keyboard = [[
      { text: '✅ Duyệt & Đăng ngay', callback_data: `approve_ai_${reviewDbId}` },
      { text: '✏️ Tôi tự viết', callback_data: `edit_manual_${reviewDbId}` },
    ]];

    const response = await axios.post(`${cfg.apiBase}/sendMessage`, {
      chat_id: cfg.chatId,
      text: message,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
    });

    const messageId = response.data.result?.message_id;
    console.log(`📢 [Telegram] Đã gửi alert kèm Draft AI cho [${name}] — msgId: ${messageId}`);
    return { success: true, messageId };
  } catch (error) {
    console.error('❌ Lỗi gửi Telegram alert:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Chỉnh sửa tin nhắn Telegram (sau khi xử lý xong)
 */
const editMessage = async (messageId, newText) => {
  const cfg = getBotConfig();
  if (!cfg) return;

  try {
    await axios.post(`${cfg.apiBase}/editMessageText`, {
      chat_id: cfg.chatId,
      message_id: messageId,
      text: newText,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.warn('⚠️ Không thể sửa tin nhắn Telegram:', error.message);
  }
};

/**
 * Trả lời callback query (bỏ loading spinner trên nút)
 */
const answerCallback = async (callbackQueryId, text = '') => {
  const cfg = getBotConfig();
  if (!cfg) return;

  try {
    await axios.post(`${cfg.apiBase}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text: text || 'Đang xử lý...',
      show_alert: false,
    });
  } catch (error) {
    console.warn('⚠️ answerCallbackQuery lỗi:', error.message);
  }
};

/**
 * Gửi tin nhắn text đơn giản
 */
const sendMessage = async (text, options = {}) => {
  const cfg = getBotConfig();
  if (!cfg) return null;

  try {
    const res = await axios.post(`${cfg.apiBase}/sendMessage`, {
      chat_id: cfg.chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    });
    return res.data.result;
  } catch (error) {
    console.error('❌ Telegram sendMessage lỗi:', error.message);
    return null;
  }
};

// ── Legacy wrapper (tương thích với code cũ gọi sendAlert) ──────────────────
const sendAlert = async (reviewData) => {
  return sendAlertWithDraft(reviewData);
};

module.exports = {
  sendAlert,
  sendAlertWithDraft,
  editMessage,
  answerCallback,
  sendMessage,
};
