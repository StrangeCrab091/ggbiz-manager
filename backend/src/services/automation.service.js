/**
 * automation.service.js — Trái tim tự động hóa của MapManager
 *
 * Chạy cron job mỗi 30 phút để:
 *  1. Quét tất cả Location đang 'active'
 *  2. Gọi Google API lấy 20 review mới nhất 
 *  3. Upsert vào DB (googleReviewId là khóa chính)
 *  4. Review 4-5 sao → AI soạn reply → Auto POST lên Google Maps
 *  5. Review 1-3 sao → KHÔNG đăng tự động → Gửi cảnh báo Telegram
 */

const cron = require('node-cron');
const Review = require('../models/review.model');
const Location = require('../models/location.model');
const aiService = require('./ai.service');
const googleBusinessService = require('./googleBusiness.service');
const telegramService = require('./telegram.service');
const teamsService = require('./teams.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Kiểm tra review có phải là thật (không phải mock/demo)
 */
const isRealReview = (review) =>
  review.googleReviewId &&
  !review.googleReviewId.startsWith('mock_') &&
  !review.googleReviewId.startsWith('sim_') &&
  review.locationId &&
  !review.locationId.startsWith('mock_') &&
  review.locationId !== 'default' &&
  review.locationId !== 'demo-id';

/**
 * Upsert một review vào MongoDB (googleReviewId là khóa chính duy nhất)
 * Trả về { doc, isNew }
 */
const upsertReview = async (rawReview) => {
  const isNew = !(await Review.exists({ googleReviewId: rawReview.reviewId }));

  // Trạng thái đích
  const targetStatus = rawReview.reviewReply ? 'Processed' : 'Pending';

  // Trường luôn được cập nhật khi đồng bộ
  const updateFields = {
    locationId: rawReview.locationId,
    reviewerName: rawReview.reviewer?.displayName || 'Khách hàng',
    rating: rawReview.starRating,
    reviewText: rawReview.comment || '',
    createTime: new Date(rawReview.createTime),
    status: targetStatus, // Di chuyển vào đây để tránh conflict với $setOnInsert
  };

  // Nếu Google đã có phản hồi, đồng bộ luôn các trường reply
  if (rawReview.reviewReply) {
    updateFields.reply_content = rawReview.reviewReply.comment;
    updateFields.replied_at = rawReview.reviewReply.updateTime
      ? new Date(rawReview.reviewReply.updateTime)
      : new Date();
    updateFields.replyText = rawReview.reviewReply.comment;
  }

  // Trường chỉ set khi INSERT mới (không bao giờ thay đổi sau khi tạo)
  const setOnInsert = {
    isRead: false,
    alertSent: false,
  };

  if (isNew) {
    // Phân tích cảm xúc + phân loại tag chỉ cho record mới
    const [sentiment, categoryTag] = await Promise.all([
      aiService.analyzeSentiment(rawReview.comment || ''),
      aiService.categorizeReview(rawReview.comment || ''),
    ]);
    // Đưa vào updateFields để cleaner và tránh conflict
    updateFields.sentiment = { tag: sentiment.tag, analysis: sentiment.analysis };
    updateFields.category_tag = categoryTag;
  }

  const doc = await Review.findOneAndUpdate(
    { googleReviewId: rawReview.reviewId },
    { $set: updateFields, $setOnInsert: setOnInsert },
    { upsert: true, new: true }
  );

  return { doc, isNew };
};

// ─── Core loop cho từng Location ──────────────────────────────────────────────

const processLocation = async (location) => {
  const locId = location.locationId;
  console.log(`\n  📍 [AUTO] Đang xử lý: ${location.title || locId}`);

  // 1. Kéo 20 review mới nhất từ Google
  let reviews = [];
  try {
    reviews = await googleBusinessService.fetchReviews(locId);
    if (!Array.isArray(reviews)) reviews = [];
    // Chỉ lấy 20 review mới nhất
    reviews = reviews.slice(0, 20);
    console.log(`     ↳ Nhận được ${reviews.length} review từ Google`);
  } catch (err) {
    console.warn(`     ⚠️ Lỗi kéo review cho ${locId}: ${err.message}`);
    return;
  }

  let newCount = 0;
  let autoReplied = 0;
  let alertSent = 0;

  for (const rawReview of reviews) {
    try {
      // 2. Upsert vào DB
      const { doc, isNew } = await upsertReview(rawReview);

      if (!isNew) continue; // Chỉ xử lý review HOÀN TOÀN MỚI

      newCount++;
      console.log(`     ✨ Review mới: [${doc.reviewerName}] ${doc.rating}⭐ → Tag: ${doc.category_tag}`);

      // 3a. Review 4-5 sao → Auto reply lên Google
      if (doc.rating >= 4) {
        try {
          const aiReply = await aiService.generateReply(
            doc.reviewText,
            doc.rating,
            doc.reviewerName
          );

          if (aiReply && isRealReview(doc)) {
            await googleBusinessService.replyToReview(
              doc.googleReviewId,
              aiReply,
              doc.locationId
            );
            console.log(`     🌐 [AUTO REPLY] Đã đăng phản hồi lên Google Maps cho: ${doc.reviewerName}`);
          }

          await Review.findByIdAndUpdate(doc._id, {
            replyText: aiReply,
            reply_content: aiReply,
            replied_at: new Date(),
            status: 'Auto-Replied',
          });

          autoReplied++;
        } catch (replyErr) {
          console.error(`     ❌ Lỗi auto-reply cho ${doc.reviewerName}: ${replyErr.message}`);
        }
      }

      // 3b. Review 1-3 sao → Tạm thời bỏ qua phần phản hồi ngay lập tức để đợi 2 phút (theo quy tắc Auto-Pilot)
      else if (doc.rating <= 3 && !doc.alertSent) {
        console.log(`     ⏳ [QUEUE] Review của [${doc.reviewerName}] đang chờ 2 phút trước khi gửi Telegram Alert.`);
        alertSent++; // Tính vào count các review được xử lý trong chu kỳ này
      }
    } catch (reviewErr) {
      console.error(`     ❌ Lỗi xử lý 1 review:`, reviewErr.message);
    }
  }

  console.log(`     ✅ Kết quả: ${newCount} mới | ${autoReplied} auto-replied | ${alertSent} alerts`);
};

// ─── Xử lý hàng đợi Alert với delay 2 phút ──────────────────────────────────────

const runQueuedAlerts = async () => {
  const DELAY_MINUTES = 2;
  const cutoffTime = new Date(Date.now() - DELAY_MINUTES * 60 * 1000);

  try {
    // Tìm các review 1-3 sao, chưa gửi alert, và đã tồn tại trong hệ thống ít nhất 2 phút
    const pendingAlerts = await Review.find({
      rating: { $lte: 3 },
      alertSent: false,
      status: 'Pending',
      createdAt: { $lte: cutoffTime },
    });

    if (pendingAlerts.length === 0) return;

    console.log(`🤖 [QUEUED ALERTS] Đang xử lý ${pendingAlerts.length} review tiêu cực đã đủ thời gian chờ...`);

    for (const doc of pendingAlerts) {
      try {
        console.log(`   🔔 Đang tạo bản nháp & gửi Telegram cho: ${doc.reviewerName}`);

        // Lấy tên chi nhánh từ DB để đưa vào alert
        const location = await Location.findOne({ locationId: doc.locationId });
        const locationName = location ? location.title : doc.locationId;

        // 1. Gọi Gemini AI soạn nháp phản hồi
        let aiDraftReply = '';
        try {
          aiDraftReply = await aiService.generateReply(
            doc.reviewText,
            doc.rating,
            doc.reviewerName
          );
          // Lưu draft vào DB
          if (aiDraftReply) {
            await Review.findByIdAndUpdate(doc._id, { replyText: aiDraftReply });
          }
        } catch (aiErr) {
          console.warn(`      ⚠️ Lỗi tạo AI draft cho ${doc.reviewerName}: ${aiErr.message}`);
        }

        // 2. Gửi Telegram alert và Teams alert song song
        const alertData = {
          rating: doc.rating,
          reviewerName: doc.reviewerName,
          comment: doc.reviewText,
          locationName: locationName,
          category: doc.category_tag,
          reviewDbId: doc._id.toString(),
          aiDraftReply
        };

        const alertResults = await Promise.allSettled([
          telegramService.sendAlertWithDraft(alertData),
          teamsService.sendTeamsAlert(alertData)
        ]);

        const telegramResult = alertResults[0].status === 'fulfilled' ? alertResults[0].value : { success: false, message: 'Crash telegram' };
        const teamsResult = alertResults[1].status === 'fulfilled' ? alertResults[1].value : { success: false, message: 'Crash teams' };

        if (telegramResult.success || teamsResult.success) {
           await Review.findByIdAndUpdate(doc._id, { 
             alertSent: true, 
             status: 'Alert-Sent' 
           });
           console.log(`      ✅ Đã gửi thông báo. Telegram: ${telegramResult.success ? 'OK' : 'Lỗi'}, Teams: ${teamsResult.success ? 'OK' : 'Lỗi'}`);
        } else {
           console.error(`      ❌ Lỗi gửi cả Telegram & Teams alert: Telegram(${telegramResult.message}) - Teams(${teamsResult.message})`);
        }
      } catch (err) {
        console.error(`   ❌ Lỗi khi xử lý 1 alert queued cho ${doc.reviewerName}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ [QUEUED ALERTS] Lỗi nghiêm trọng:', err.message);
  }
};

// ─── Cron Job chính ───────────────────────────────────────────────────────────

let isRunning = false; // Guard: tránh chạy chồng chéo

const runAutomationCycle = async () => {
  if (isRunning) {
    console.log('⏭️  [AUTO] Chu kỳ trước chưa xong, bỏ qua lần này.');
    return;
  }

  isRunning = true;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🤖 [AUTO SCAN] Bắt đầu chu kỳ quét — ${new Date().toLocaleString('vi-VN')}`);
  console.log(`${'═'.repeat(60)}`);

  try {
    // Lấy tất cả Location không phải mock
    const locations = await Location.find({
      locationId: { $not: /^mock_/ }
    });

    if (locations.length === 0) {
      console.log('  ⚠️ Chưa có chi nhánh thật nào trong DB. Bỏ qua.');
      return;
    }

    console.log(`  🔎 Tìm thấy ${locations.length} chi nhánh để quét...`);

    // Xử lý tuần tự từng Location (tránh rate limit Google API)
    for (const loc of locations) {
      await processLocation(loc);
    }

    console.log(`\n✅ [AUTO SCAN] Chu kỳ hoàn tất — ${new Date().toLocaleString('vi-VN')}`);
  } catch (err) {
    console.error('❌ [AUTO SCAN] Lỗi nghiêm trọng trong chu kỳ quét:', err.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Khởi động Automation Service
 * - Chạy ngay 1 lần khi server start (sau 30 giây để DB ổn định)
 * - Sau đó cron mỗi 30 phút
 */
const startAutomationService = () => {
  // Chạy sau 30 giây kể từ khi server khởi động
  setTimeout(() => {
    console.log('⏰ [AUTO] Chạy lần đầu sau khi server khởi động...');
    runAutomationCycle();
  }, 30 * 1000);

  // Cron: mỗi 30 phút (vào phút 0 và 30 của mỗi giờ) để quét location
  cron.schedule('0,30 * * * *', () => {
    runAutomationCycle();
  });

  // Cron: mỗi 1 phút để xử lý các review tiêu cực đang đợi trong queue
  cron.schedule('* * * * *', () => {
    runQueuedAlerts();
  });

  console.log('🤖 Automation Service đã khởi động — Chu kỳ quét: mỗi 30 phút.');
  console.log('   Hàng đợi 1-3 sao (2 phút delay): Kiểm tra hàng phút.');
  console.log('   Cron: "0,30 * * * *" — Chạy vào phút 0 và 30 mỗi giờ');
};

module.exports = {
  startAutomationService,
  runAutomationCycle, // Export để có thể gọi thủ công từ admin endpoint nếu cần
  upsertReview,       // Export để dùng chung trong syncReviews controller
};
