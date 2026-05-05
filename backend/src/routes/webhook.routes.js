const express = require('express');
const router = express.Router();
const { telegramAction, telegramCallback } = require('../controllers/webhook.controller');

/**
 * POST /api/webhook/telegram-callback
 * Endpoint chính — Nhận update từ Telegram Bot API (setWebhook)
 * Xử lý: callback_query (nút bấm) + message reply (user gõ phản hồi)
 */
router.post('/telegram-callback', telegramCallback);

/**
 * POST /api/webhook/telegram-action
 * Endpoint phụ (Legacy) — Dùng bởi n8n / external tools
 * Payload: { secret, googleReviewId, action, replyText? }
 */
router.post('/telegram-action', telegramAction);

module.exports = router;
