const express = require('express');

const router = express.Router();

const reviewRoutes = require('./review.routes');
const authRoutes = require('./auth.routes');
const locationRoutes = require('./location.routes');
const automationRoutes = require('./automation.routes');
const competitorRoutes = require('./competitor.routes');
const userRoutes = require('./user.routes');
const spamRoutes = require('./spam.routes');
const analyticsRoutes = require('./analytics.routes');
const webhookRoutes = require('./webhook.routes');
const testRoutes = require('./test.routes');

// Google OAuth (dùng để kết nối tài khoản Google Business)
router.use('/auth', authRoutes);
router.use('/test-google-connection', testRoutes);

// Webhook (bảo mật bằng secret token trong body)
router.use('/webhook', webhookRoutes);

const reviewController = require('../controllers/review.controller');
router.post('/automation/auto-reply', reviewController.autoReplyForN8N);

router.use('/reviews', reviewRoutes);
router.use('/locations', locationRoutes);
router.use('/spam', spamRoutes);
router.use('/analytics', analyticsRoutes);

const qaRoutes = require('./qa.routes');
router.use('/qa', qaRoutes);

router.use('/users', userRoutes);
router.use('/automation', automationRoutes);
router.use('/competitor', competitorRoutes);

module.exports = router;
