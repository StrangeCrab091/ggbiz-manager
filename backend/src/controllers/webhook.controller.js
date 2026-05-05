/**
 * webhook.controller.js — Xử lý Webhook từ Telegram Bot
 *
 * Endpoint chính: POST /api/webhook/telegram-callback
 *   Nhận update từ Telegram Bot API (setWebhook hoặc polling proxy)
 *
 * Xử lý 2 loại update:
 *   1. callback_query  → Khi user nhấn nút Inline
 *      - approve_ai_{reviewId}   → Đăng AI draft lên Google Maps
 *      - edit_manual_{reviewId}  → Nhắc user reply tin nhắn
 *   2. message (reply)  → Khi user reply tin nhắn alert → Đăng content tùy chỉnh
 *
 * Endpoint phụ: POST /api/webhook/telegram-action (legacy — dùng bởi n8n)
 */

const Review = require('../models/review.model');
const googleBusinessService = require('../services/googleBusiness.service');
const telegramService = require('../services/telegram.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isRealReview = (review) =>
  review.googleReviewId &&
  !review.googleReviewId.startsWith('mock_') &&
  !review.googleReviewId.startsWith('sim_') &&
  review.locationId &&
  !review.locationId.startsWith('mock_') &&
  review.locationId !== 'default' &&
  review.locationId !== 'demo-id';

/**
 * Đăng reply lên Google Maps + cập nhật DB
 * @returns {Object} { success, message, pushedToGoogle }
 */
const postReplyAndUpdateDB = async (review, replyText, source = 'Telegram') => {
  let pushedToGoogle = false;

  if (isRealReview(review)) {
    try {
      await googleBusinessService.replyToReview(
        review.googleReviewId,
        replyText,
        review.locationId
      );
      pushedToGoogle = true;
      console.log(`✅ [${source}] Đã đăng reply lên Google Maps cho: ${review.reviewerName}`);
    } catch (googleErr) {
      console.error(`❌ [${source}] Lỗi Google API:`, googleErr.message);

      // Thông báo lỗi rõ ràng nếu token hết hạn
      const errMsg = googleErr.status === 401
        ? '🔑 Token Google đã hết hạn. Vui lòng kết nối lại trong Settings.'
        : googleErr.status === 429
          ? '⏳ Google API hết hạn mức. Vui lòng thử lại sau.'
          : `Lỗi Google API: ${googleErr.message}`;

      return { success: false, message: errMsg, pushedToGoogle: false };
    }
  } else {
    console.log(`📝 [${source}] Review giả lập — chỉ lưu DB.`);
  }

  // Cập nhật DB
  review.replyText = replyText;
  review.reply_content = replyText;
  review.replied_at = new Date();
  review.status = 'AI-Replied';
  await review.save();
  console.log(`💾 [${source}] DB đã cập nhật cho [${review.reviewerName}]`);

  return { success: true, message: 'OK', pushedToGoogle };
};

// ─── Telegram Callback Handler ────────────────────────────────────────────────

/**
 * POST /api/webhook/telegram-callback
 * Nhận update trực tiếp từ Telegram Bot API
 */
const telegramCallback = async (req, res) => {
  // Telegram gửi update, luôn trả 200 ngay để tránh retry
  res.status(200).json({ ok: true });

  try {
    const update = req.body;

    // ── Case 1: Callback Query (nhấn nút Inline) ────────────────────────
    if (update.callback_query) {
      const cbQuery = update.callback_query;
      const cbData = cbQuery.data; // e.g. "approve_ai_6789abc" or "edit_manual_6789abc"
      const callbackQueryId = cbQuery.id;
      const messageId = cbQuery.message?.message_id;
      const originalText = cbQuery.message?.text || '';

      console.log(`\n📩 [Telegram CB] Nhận callback: ${cbData}`);

      // Xử lý nút "Duyệt & Đăng ngay"
      if (cbData.startsWith('approve_ai_')) {
        const reviewId = cbData.replace('approve_ai_', '');
        await telegramService.answerCallback(callbackQueryId, '⏳ Đang đăng phản hồi AI...');

        const review = await Review.findById(reviewId);
        if (!review) {
          await telegramService.editMessage(
            messageId,
            `${originalText}\n\n❌ <b>Lỗi:</b> Không tìm thấy review trong DB.`
          );
          return;
        }

        // Lấy AI draft đã soạn sẵn
        const aiDraft = review.replyText;
        if (!aiDraft) {
          await telegramService.editMessage(
            messageId,
            `${originalText}\n\n❌ <b>Lỗi:</b> Chưa có bản nháp AI để đăng.`
          );
          return;
        }

        const result = await postReplyAndUpdateDB(review, aiDraft, 'Telegram-Approve');

        if (result.success) {
          await telegramService.editMessage(
            messageId,
            [
              `✅ <b>ĐÃ PHẢN HỒI THÀNH CÔNG</b> ✅`,
              ``,
              `👤 <b>Khách hàng:</b> ${review.reviewerName}`,
              `⭐ <b>Đánh giá:</b> ${'⭐'.repeat(review.rating)} (${review.rating} sao)`,
              ``,
              `💬 <b>Phản hồi đã đăng (AI):</b>`,
              `<i>"${aiDraft}"</i>`,
              ``,
              `${result.pushedToGoogle ? '🌐 Đã đẩy lên Google Maps' : '📝 Đã lưu DB (review giả lập)'}`,
              `⏰ ${new Date().toLocaleString('vi-VN')}`,
            ].join('\n')
          );
        } else {
          await telegramService.editMessage(
            messageId,
            `${originalText}\n\n❌ <b>${result.message}</b>`
          );
        }
      }

      // Xử lý nút "Tôi tự viết"
      else if (cbData.startsWith('edit_manual_')) {
        const reviewId = cbData.replace('edit_manual_', '');
        await telegramService.answerCallback(callbackQueryId, '✏️ Hãy reply tin nhắn này...');

        const review = await Review.findById(reviewId);
        const reviewerInfo = review ? review.reviewerName : 'Khách hàng';

        // Sửa tin nhắn + nhắc reply
        await telegramService.editMessage(
          messageId,
          [
            `✏️ <b>CHẾ ĐỘ TỰ VIẾT</b>`,
            ``,
            `👤 <b>Khách hàng:</b> ${reviewerInfo}`,
            `📝 <b>Review ID:</b> <code>${reviewId}</code>`,
            ``,
            `👉 Hãy <b>Reply (trả lời)</b> tin nhắn này với nội dung bạn muốn đăng lên Google Maps.`,
            ``,
            `<i>⏳ Đang chờ phản hồi của bạn...</i>`,
          ].join('\n')
        );
      }
    }

    // ── Case 2: Reply Message (user gõ text reply vào tin nhắn alert) ────
    else if (update.message && update.message.reply_to_message) {
      const userText = update.message.text;
      const repliedMsg = update.message.reply_to_message;
      const repliedText = repliedMsg.text || '';

      console.log(`\n📩 [Telegram Reply] Nhận reply text: "${userText?.substring(0, 50)}..."`);

      // Trích xuất Review ID từ tin nhắn gốc (format: "Review ID: 6789abc")
      const idMatch = repliedText.match(/Review ID:\s*([a-f0-9]{24})/i);
      if (!idMatch) {
        // Cũng thử tìm từ callback_data pattern trong tin nhắn gốc
        console.log('⚠️ Không tìm thấy Review ID trong tin nhắn được reply.');
        await telegramService.sendMessage(
          '⚠️ Không tìm thấy Review ID. Hãy nhấn nút "✏️ Tôi tự viết" trước, rồi Reply tin nhắn đó.'
        );
        return;
      }

      const reviewId = idMatch[1];
      const review = await Review.findById(reviewId);

      if (!review) {
        await telegramService.sendMessage(`❌ Không tìm thấy review ID: <code>${reviewId}</code>`);
        return;
      }

      if (!userText || userText.trim() === '') {
        await telegramService.sendMessage('⚠️ Nội dung phản hồi trống. Hãy gõ nội dung và thử lại.');
        return;
      }

      // Thông báo đang xử lý
      await telegramService.sendMessage(`⏳ Đang đăng phản hồi cho <b>${review.reviewerName}</b>...`);

      const result = await postReplyAndUpdateDB(review, userText.trim(), 'Telegram-Manual');

      if (result.success) {
        await telegramService.sendMessage([
          `✅ <b>ĐÃ PHẢN HỒI THÀNH CÔNG</b>`,
          ``,
          `👤 <b>Khách hàng:</b> ${review.reviewerName}`,
          `💬 <b>Nội dung bạn viết:</b>`,
          `<i>"${userText.trim()}"</i>`,
          ``,
          `${result.pushedToGoogle ? '🌐 Đã đẩy lên Google Maps' : '📝 Đã lưu DB'}`,
        ].join('\n'));
      } else {
        await telegramService.sendMessage(`❌ <b>Lỗi:</b> ${result.message}`);
      }
    }
  } catch (error) {
    console.error('❌ [Telegram Callback] Lỗi xử lý:', error.message);
  }
};

// ─── Legacy Telegram Action (cho n8n / external tools) ────────────────────────

const telegramAction = async (req, res) => {
  try {
    const { googleReviewId, replyText: bodyReplyText, action, secret } = req.body;

    const expectedSecret = process.env.WEBHOOK_SECRET || 'mapmanager_webhook_2024';
    if (secret !== expectedSecret) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!googleReviewId || !action) {
      return res.status(400).json({ success: false, message: 'Thiếu googleReviewId hoặc action' });
    }

    const review = await Review.findOne({ googleReviewId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy review: ${googleReviewId}`,
      });
    }

    let finalReplyText;
    if (action === 'approve_ai') {
      finalReplyText = review.replyText;
      if (!finalReplyText) {
        return res.status(400).json({ success: false, message: 'Chưa có AI draft' });
      }
    } else if (action === 'custom_reply') {
      finalReplyText = bodyReplyText;
      if (!finalReplyText) {
        return res.status(400).json({ success: false, message: 'Thiếu replyText' });
      }
    } else {
      return res.status(400).json({ success: false, message: `action không hợp lệ: ${action}` });
    }

    const result = await postReplyAndUpdateDB(review, finalReplyText, 'n8n-Webhook');

    if (!result.success) {
      return res.status(502).json({ success: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      message: result.pushedToGoogle
        ? '✅ Đã gửi lên Google Maps!'
        : '📝 Đã lưu DB (review giả lập).',
      data: {
        reviewId: review._id,
        reviewerName: review.reviewerName,
        replyText: finalReplyText,
        pushedToGoogle: result.pushedToGoogle,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi telegramAction:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { telegramCallback, telegramAction };
