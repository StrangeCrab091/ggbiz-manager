/**
 * review.controller.js - Controller xử lý logic cho Review
 *
 * Nguyên tắc Single Responsibility:
 * - Controller chỉ điều phối luồng xử lý (orchestration)
 * - Logic nghiệp vụ được truyền cho Mongoose Model (MongoDB)
 */

const Review = require('../models/review.model');
const googleBusinessService = require('../services/googleBusiness.service');
const aiService = require('../services/ai.service');
const telegramService = require('../services/telegram.service');
const spamService = require('../services/spam.service');
const AutoReplyRule = require('../models/autoReplyRule.model');
const ExcelJS = require('exceljs');

/**
 * Helper: Xây dựng query filter từ các tham số
 */
const buildFilterQuery = (queryParams, user = null) => {
  const { startDate, endDate, rating, locationId, sentiment, status } = queryParams;
  const query = {};

  // RBAC: Lọc danh sách location được phép xem cho manager
  if (user && user.role === 'manager') {
    if (locationId && locationId !== 'all') {
       // Chỉ cho phép xem nếu thuộc assignedLocations
       if (user.assignedLocations && user.assignedLocations.includes(locationId)) {
          query.locationId = locationId;
       } else {
          // Báo lỗi bằng cách truyền ID không tồn tại
          query.locationId = 'UNAUTHORIZED_ACCESS';
       }
    } else {
       // Lọc tất cả các branch manager quản lý (khi locationId là 'all' hoặc trống)
       query.locationId = { $in: user.assignedLocations || [] };
    }
  } else if (locationId && locationId !== 'all') {
    query.locationId = locationId;
  }

  // Helper to validate date string from query params
  const isValidDate = (d) => d && d.trim() !== '' && d !== 'null' && d !== 'undefined' && d !== 'invalid date';

  const hasStart = isValidDate(startDate);
  const hasEnd = isValidDate(endDate);

  // Lọc theo thời gian (createTime)
  if (hasStart || hasEnd) {
    query.createTime = {};
    if (hasStart) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        query.createTime.$gte = start;
      }
    }
    if (hasEnd) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        query.createTime.$lte = end;
      }
    }
  }

  // Lọc theo rating và sentiment
  if (rating && rating !== 'all') {
    if (rating === '1-2') {
      query.rating = { $in: [1, 2] };
    } else {
      query.rating = Number(rating);
    }
  } else if (sentiment) {
    if (sentiment === 'positive') {
      query.rating = { $gte: 4 };
    } else if (sentiment === 'negative') {
      query.rating = { $lte: 2 };
    }
  }

  // Lọc theo trạng thái phản hồi
  if (status) {
    if (status === 'replied') {
      query.replyText = { $nin: [null, ""] };
    } else if (status === 'unreplied') {
      query.replyText = { $in: [null, ""] };
    }
  }

  return query;
};

/**
 * GET /api/reviews
 * Lấy danh sách đánh giá từ MongoDB (Persistent) kèm bộ lọc
 */
const getReviews = async (req, res, next) => {
  try {
    const filterQuery = buildFilterQuery(req.query, req.user);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Review.countDocuments(filterQuery);

    // Truy vấn dữ liệu từ MongoDB, sắp xếp theo thời gian mới nhất, có phân trang
    const reviews = await Review.find(filterQuery)
      .sort({ createTime: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách review từ MongoDB:', error.message);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách đánh giá: ' + error.message,
    });
  }
};

/**
 * POST /api/reviews/process
 * Xử lý một review mới từ Webhook/API: phân tích -> phản hồi -> lưu DB
 */
const processNewReview = async (req, res, next) => {
  try {
    const { locationId, googleReviewId, reviewerName, rating, comment } = req.body;

    if (!rating) {
      return res.status(400).json({ success: false, message: 'Rating là bắt buộc' });
    }

    console.log(`\n📝 XỬ LÝ REVIEW MỚI: ${reviewerName} - ${rating} sao`);

    // 1. Phân tích cảm xúc & Phân loại
    const sentiment = await aiService.analyzeSentiment(comment || '');
    const categoryTag = await aiService.categorizeReview(comment || '');

    // 2. Cảnh báo Telegram nếu tiêu cực
    let alertSent = false;
    if (rating <= 2) {
      try {
        const tResult = await telegramService.sendAlert({ rating, reviewerName, comment });
        alertSent = tResult.success;
      } catch (e) {
        console.warn('⚠️ Alert Telegram lỗi:', e.message);
      }
    }

    // 3. Tự động phản hồi (Auto-Reply 5 sao hoặc AI)
    let finalReply = '';
    let status = 'Processed';
    
    if (rating === 5 && (!comment || comment.trim() === '')) {
      const templates = [
        'Cảm ơn bạn đã đánh giá 5 sao cho dịch vụ của chúng tôi!',
        'Thật tuyệt vời! Động lực lớn cho đội ngũ của chúng tôi.',
        'Hẹn gặp lại bạn sớm nhé!'
      ];
      finalReply = templates[Math.floor(Math.random() * templates.length)];
      status = 'Auto-Replied';
    } else {
      // Tìm quy tắc phù hợp để lấy custom prompt
      const rules = await AutoReplyRule.find({ isActive: true });
      const matchedRule = rules.find(rule => {
        const starsMatch = rating >= rule.minStars && rating <= rule.maxStars;
        if (!starsMatch) return false;
        
        const hasText = comment && comment.trim().length > 0;
        if (rule.conditionHasText === 'has_text' && !hasText) return false;
        if (rule.conditionHasText === 'no_text' && hasText) return false;
        return true;
      });

      finalReply = await aiService.generateReply(
        comment || '', 
        rating, 
        reviewerName, 
        matchedRule ? matchedRule.aiPrompt : ''
      );
      status = 'AI-Replied';
    }

    // 4. Lưu vào MongoDB
    const newReview = await Review.create({
      googleReviewId: googleReviewId || `real_${Date.now()}`,
      locationId: locationId || 'default',
      reviewerName: reviewerName || 'Ẩn danh',
      rating,
      reviewText: comment || '',
      sentiment: { tag: sentiment.tag, analysis: sentiment.analysis },
      category_tag: categoryTag,
      replyText: finalReply,
      alertSent: alertSent,
      status: alertSent ? 'Alert-Sent' : status,
      createTime: new Date()
    });

    // 5. Kiểm tra Spam (Anti-Sabotage)
    spamService.detectSpamPatterns(locationId || 'default', [newReview]);

    return res.status(201).json({
      success: true,
      data: newReview
    });
  } catch (error) {
    console.error('❌ Lỗi processNewReview:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/reviews/simulate
 * Giả lập đánh giá và lưu vĩnh viễn vào DB
 */
const simulateReview = async (req, res) => {
  try {
    const { locationId, type } = req.body;
    let reviewData = {};

    if (type === '5star_empty') {
      const positiveComments = [
        '(Đánh giá 5 sao không kèm bình luận)',
        'Dịch vụ rất tốt, nhân viên hỗ trợ nhiệt tình và chuyên nghiệp.',
        'Mình rất hài lòng! Đội ngũ hỗ trợ xử lý vấn đề nhanh chóng, đáng 5 sao!'
      ];
      const selectedComment = positiveComments[Math.floor(Math.random() * positiveComments.length)];
      
      reviewData = {
        googleReviewId: `sim_5_${Date.now()}`,
        locationId: locationId || 'demo-id',
        reviewerName: ['Anh Hoàng', 'Chị Lan', 'Minh Trần', 'Khách hàng thân thiết ✨'][Math.floor(Math.random() * 4)],
        rating: 5,
        reviewText: selectedComment,
        replyText: '',
        status: 'Pending',
        createTime: new Date()
      };
      console.log(`✨ [Simulate] Đã chuẩn bị review 5 sao (Chờ Auto-Pilot) cho: ${reviewData.reviewerName}`);
    } else {
      const negativeComments = [
        'Email gửi cho đối tác toàn bị vào hòm Spam, làm lỡ hết hợp đồng. Yêu cầu xử lý ngay!',
        'Dịch vụ bị gián đoạn từ sáng, liên hệ hỗ trợ mãi không được, quá tệ.',
        '(Đánh giá 1 sao không kèm bình luận)'
      ];
      const selectedComment = negativeComments[Math.floor(Math.random() * negativeComments.length)];

      reviewData = {
        googleReviewId: `sim_1_${Date.now()}`,
        locationId: locationId || 'demo-id',
        reviewerName: ['User_99', 'Ẩn danh', 'Khách hàng khó tính 😡', 'Thành Nam'][Math.floor(Math.random() * 4)],
        rating: Math.random() > 0.5 ? 1 : 2,
        reviewText: selectedComment,
        replyText: '',
        status: 'Pending',
        createTime: new Date()
      };
      console.log(`🚨 [Simulate] Đã chuẩn bị review tiêu cực (Chờ Auto-Pilot) cho: ${reviewData.reviewerName}`);

      // Gửi Telegram (chỉ thông báo có review mới)
      try {
        await telegramService.sendAlert({
          rating: reviewData.rating,
          reviewerName: reviewData.reviewerName,
          comment: reviewData.reviewText
        });
      } catch (e) {
        console.warn('⚠️ Telegram simulation error:', e.message);
      }
    }

    // Lưu vào MongoDB vĩnh viễn
    try {
      const savedReview = await Review.create(reviewData);
      console.log(`💾 [Simulate] Đã lưu thành công (ID: ${savedReview._id})`);

      return res.status(200).json({
        success: true,
        message: 'Giả lập thành công',
        data: savedReview
      });
    } catch (dbError) {
      console.error('❌ Lỗi Ghi MongoDB:', dbError);
      return res.status(500).json({ 
        success: false, 
        message: 'Lỗi ghi cơ sở dữ liệu: ' + dbError.message 
      });
    }
  } catch (error) {
    console.error('❌ Lỗi Logic Giả lập:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reviews/stats
 * Thống kê từ dữ liệu thực tế MongoDB kèm bộ lọc
 */
const getReviewStats = async (req, res, next) => {
  try {
    const filterQuery = buildFilterQuery(req.query, req.user);

    // 1. Tổng số theo bộ lọc
    const totalReviews = await Review.countDocuments(filterQuery);

    // 2. Điểm trung bình theo bộ lọc
    const avgResult = await Review.aggregate([
      { $match: filterQuery },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    const averageRating = avgResult.length > 0 ? avgResult[0].avgRating.toFixed(1) : 0;

    // 3. Review mới trong 24h (Không phụ thuộc bộ lọc ngày để giữ tính 'Real-time alert')
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newReviewsCount = await Review.countDocuments({
      createTime: { $gte: twentyFourHoursAgo }
    });

    // 4. Thống kê theo cảm xúc/sao (Dựa trên bộ lọc)
    const positiveCount = await Review.countDocuments({ ...filterQuery, rating: { $gte: 4 } });
    const neutralCount = await Review.countDocuments({ ...filterQuery, rating: 3 });
    const negativeCount = await Review.countDocuments({ ...filterQuery, rating: { $lte: 2 } });

    // Review chưa phản hồi (Pending)
    const pendingCount = await Review.countDocuments({
      ...filterQuery,
      $or: [{ replyText: null }, { replyText: '' }, { status: 'Pending' }]
    });

    // Phân bổ sao
    const starDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const starDistAgg = await Review.aggregate([
      { $match: filterQuery },
      { $group: { _id: '$rating', count: { $sum: 1 } } }
    ]);
    starDistAgg.forEach(item => {
      if (item._id && starDistribution[item._id] !== undefined) {
        starDistribution[item._id] = item.count;
      }
    });

    // Tính phần trăm tích cực
    const positivePercentage = totalReviews > 0 
      ? Math.round((positiveCount / totalReviews) * 100) 
      : 0;

    // 5. 4 Review mới nhất
    const latestReviews = await Review.find().sort({ createTime: -1 }).limit(4);

    // 6. Biểu đồ 7 ngày (Hoặc theo bộ lọc thời gian nếu muốn, nhưng mặc định là 7 ngày gần nhất)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const total = await Review.countDocuments({
        ...filterQuery,
        createTime: { $gte: date, $lt: nextDate }
      });
      
      const positive = await Review.countDocuments({
        ...filterQuery,
        rating: { $gte: 4 },
        createTime: { $gte: date, $lt: nextDate }
      });

      const negative = await Review.countDocuments({
        ...filterQuery,
        rating: { $lte: 2 },
        createTime: { $gte: date, $lt: nextDate }
      });

      chartData.push({
        name: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        total,
        positive,
        negative
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalReviews,
        averageRating,
        newReviewsCount,
        positivePercentage,
        positiveCount,
        neutralCount,
        negativeCount,
        pendingCount,
        starDistribution,
        latestReviews,
        chartData
      }
    });
  } catch (error) {
    console.error('❌ Lỗi tính toán thống kê:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Các hàm hỗ trợ khác
 */

/**
 * GET /api/reviews/export
 * Xuất danh sách review ra file Excel dữa trên bộ lọc
 */
const exportReviews = async (req, res) => {
  try {
    const filterQuery = buildFilterQuery(req.query, req.user);
    const reviews = await Review.find(filterQuery).sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách Đánh giá');

    worksheet.columns = [
      { header: 'Ngày tháng', key: 'date', width: 20 },
      { header: 'Tên khách hàng', key: 'name', width: 30 },
      { header: 'Số sao', key: 'stars', width: 10 },
      { header: 'Cảm xúc (AI)', key: 'sentiment', width: 15 },
      { header: 'Nội dung review', key: 'content', width: 50 },
      { header: 'Nội dung phản hồi', key: 'reply', width: 50 },
    ];

    // Style Header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' } // indigo-100
    };

    reviews.forEach(review => {
      worksheet.addRow({
        date: new Date(review.createTime || review.createdAt).toLocaleString('vi-VN'),
        name: review.reviewerName,
        stars: review.rating,
        sentiment: review.sentiment?.tag || (review.rating >= 4 ? 'Tích cực' : (review.rating <= 2 ? 'Tiêu cực' : 'Trung lập')),
        content: review.reviewText || '(Không có bình luận)',
        reply: review.replyText || '(Chưa phản hồi)'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reviews_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('❌ Lỗi xuất báo cáo Excel:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reviews/notifications
 * Lấy danh sách thông báo review tiêu cực chưa đọc
 */
const getUnreadNotifications = async (req, res) => {
  try {
    const { locationId } = req.query;
    const query = { rating: { $lte: 2 }, isRead: false };
    
    // RBAC
    if (req.user && req.user.role === 'manager') {
       if (locationId && locationId !== 'all') {
          if (req.user.assignedLocations && req.user.assignedLocations.includes(locationId)) {
             query.locationId = locationId;
          } else {
             query.locationId = 'UNAUTHORIZED_ACCESS';
          }
       } else {
          query.locationId = { $in: req.user.assignedLocations || [] };
       }
    } else {
      if (locationId && locationId !== 'all') {
        query.locationId = locationId;
      }
    }

    const notifications = await Review.find(query).sort({ createTime: -1 }).limit(10);
    return res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('❌ Lỗi lấy thông báo:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/reviews/notifications/:id/read
 * Đánh dấu một thông báo là đã đọc
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedReview = await Review.findByIdAndUpdate(id, { isRead: true }, { new: true });
    return res.status(200).json({ success: true, data: updatedReview });
  } catch (error) {
    console.error('❌ Lỗi cập nhật trạng thái đã đọc:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const generateReplyFromAI = async (req, res) => {
  try {
    const { comment, rating, reviewerName } = req.body;
    
    // Tìm quy tắc phù hợp để lấy custom prompt
    const rules = await AutoReplyRule.find({ isActive: true });
    const matchedRule = rules.find(rule => {
      const starsMatch = rating >= rule.minStars && rating <= rule.maxStars;
      if (!starsMatch) return false;
      
      const hasText = comment && comment.trim().length > 0;
      if (rule.conditionHasText === 'has_text' && !hasText) return false;
      if (rule.conditionHasText === 'no_text' && hasText) return false;
      return true;
    });

    const aiReply = await aiService.generateReply(
      comment || '', 
      rating, 
      reviewerName || 'Quý khách',
      matchedRule ? matchedRule.aiPrompt : ''
    );

    return res.status(200).json({ success: true, data: { reply: aiReply } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/reviews/submit-reply
 * Lưu câu trả lời vào Database VÀ đẩy lên Google Maps (nếu là review thật)
 * Body: { reviewId (MongoDB _id), replyText }
 */
const submitReply = async (req, res) => {
  try {
    const { reviewId, replyText } = req.body;
    if (!reviewId || !replyText) {
      return res.status(400).json({ success: false, message: 'reviewId và replyText là bắt buộc' });
    }

    // 1. Tìm review trong DB
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy review trong hệ thống' });
    }

    // 2. Đẩy phản hồi lên Google Maps (nếu là review thật)
    const isReal = review.googleReviewId && 
                   !review.googleReviewId.startsWith('mock_') && 
                   !review.googleReviewId.startsWith('sim_') &&
                   review.locationId && 
                   !review.locationId.startsWith('mock_') && 
                   review.locationId !== 'default' &&
                   review.locationId !== 'demo-id';

    let googleResponse = null;
    if (isReal) {
      try {
        googleResponse = await googleBusinessService.replyToReview(
          review.googleReviewId, 
          replyText, 
          review.locationId
        );
        console.log(`✅ [Submit Reply] Đã đẩy phản hồi lên Google Maps cho review: ${review.reviewerName}`);
      } catch (googleErr) {
        console.error(`❌ [Submit Reply] Lỗi đẩy lên Google:`, googleErr.message);
        // Vẫn lưu DB dù Google lỗi, nhưng thông báo cho user
        return res.status(googleErr.status || 500).json({
          success: false,
          message: 'Lỗi khi đẩy phản hồi lên Google Maps: ' + googleErr.message,
          savedLocally: true
        });
      }
    } else {
      console.log(`📝 [Submit Reply] Review giả lập/demo - chỉ lưu local DB.`);
    }

    // 3. Lưu vào MongoDB
    review.replyText = replyText;
    review.reply_content = replyText;
    review.replied_at = new Date();
    review.status = 'AI-Replied';
    await review.save();

    console.log(`💾 [Submit Reply] Đã lưu phản hồi cho [${review.reviewerName}] vào DB.`);

    return res.status(200).json({
      success: true,
      message: isReal 
        ? 'Đã gửi phản hồi lên Google Maps và lưu vào hệ thống thành công!' 
        : 'Đã lưu phản hồi vào hệ thống (review giả lập, không đẩy Google).',
      data: {
        reviewId: review._id,
        replyText: replyText,
        pushedToGoogle: isReal,
        googleResponse: googleResponse
      }
    });
  } catch (error) {
    console.error('❌ Lỗi submitReply:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const testTelegramAlert = async (req, res) => {
  try {
    const result = await telegramService.sendAlert({
      rating: 1,
      reviewerName: 'Admin Test',
      comment: 'Tin nhắn test persistent mode!'
    });
    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/reviews/sync
 * Gọi Google API lấy danh sách review thật và lưu vào MongoDB
 */
const syncReviews = async (req, res) => {
  try {
    const { locationId } = req.body;
    if (!locationId) {
      return res.status(400).json({ success: false, message: 'locationId là bắt buộc' });
    }

    console.log(`\n🔄 [SYNC] Bắt đầu đồng bộ đánh giá cho chi nhánh: ${locationId}`);

    // Kéo list review MỚI NHẤT từ Google Business API bằng Token 
    let googleReviews = [];
    try {
      // Yêu cầu 2: Backend nhận ID, kiểm tra Access Token & gọi API với locationId động
      googleReviews = await googleBusinessService.fetchReviews(locationId);
      
      // Chuyển format để tương thích với phần lưu DB phía dưới
      if (!Array.isArray(googleReviews)) {
         googleReviews = googleReviews.reviews || [];
      }
    } catch (googleErr) {
      console.warn('⚠️ [Sync Controller] Lỗi Google API:', googleErr.message);
      return res.status(googleErr.status || 400).json({ 
        success: false, 
        message: googleErr.message 
      });
    }

    let newCount = 0;
    let updatedCount = 0;
    
    // 🔄 UPSERT LOOP — reviewId là khóa chính, không bao giờ xóa dữ liệu cũ
    for (const rawReview of googleReviews) {
      const isNew = !(await Review.exists({ googleReviewId: rawReview.reviewId }));
      
      // Trạng thái đích
      const targetStatus = rawReview.reviewReply ? 'Processed' : 'Pending';

      // Các trường cập nhật cho cả record mới lẫn cũ
      const updateFields = {
        locationId: rawReview.locationId,
        reviewerName: rawReview.reviewer?.displayName || 'Khách hàng',
        rating: rawReview.starRating,
        reviewText: rawReview.comment || '',
        createTime: new Date(rawReview.createTime),
        status: targetStatus, // Luôn update status để tránh conflict
      };

      // Cập nhật reply nếu Google đã có reply
      if (rawReview.reviewReply) {
        updateFields.reply_content = rawReview.reviewReply.comment;
        updateFields.replied_at = rawReview.reviewReply.updateTime 
          ? new Date(rawReview.reviewReply.updateTime) : new Date();
        updateFields.replyText = rawReview.reviewReply.comment;
      }

      // Chỉ set một lần khi INSERT record mới
      const setOnInsert = {
        alertSent: false,
        isRead: false,
      };

      if (isNew) {
        // Phân tích cảm xúc & AI Tagging song song
        const [sentiment, categoryTag] = await Promise.all([
          aiService.analyzeSentiment(rawReview.comment || ''),
          aiService.categorizeReview(rawReview.comment || '')
        ]);
        // Gán vào updateFields cho an toàn
        updateFields.sentiment = { tag: sentiment.tag, analysis: sentiment.analysis };
        updateFields.category_tag = categoryTag;
        console.log(`   ✨ [SYNC] Review mới: [${rawReview.reviewer?.displayName || 'Khách hàng'}] → Tag: ${categoryTag}`);
      }

      await Review.findOneAndUpdate(
        { googleReviewId: rawReview.reviewId },
        {
          $set: updateFields,
          $setOnInsert: setOnInsert
        },
        { upsert: true, new: true }
      );

      if (isNew) {
        newCount++;
        // Cảnh báo Telegram nếu 1-2 sao MỚI
        if (rawReview.starRating <= 2) {
          try {
            await telegramService.sendAlert({
              rating: rawReview.starRating,
              reviewerName: rawReview.reviewer?.displayName || 'Khách hàng',
              comment: rawReview.comment || ''
            });
          } catch(e) { console.warn('⚠️ Telegram alert failed:', e.message); }
        }
      } else {
        updatedCount++;
      }
    }

    console.log(`✅ [SYNC] Đồng bộ thành công: Thêm mới ${newCount}, cập nhật ${updatedCount}/${googleReviews.length} đánh giá.`);

    // [QUAN TRỌNG] Kiểm tra Spam/Tấn công bẩn ngay sau khi đồng bộ
    if (googleReviews.length > 0) {
      spamService.detectSpamPatterns(locationId, googleReviews);
    }

    return res.status(200).json({
      success: true,
      message: `Đồng bộ thành công! Tổng ${googleReviews.length} review: Thêm mới ${newCount}, cập nhật ${updatedCount}.`,
    });
    
  } catch (error) {
    console.error('❌ Lỗi hệ thống khi Đồng bộ:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reviews/insights
 * Lấy AI Insights từ danh sách đánh giá
 */
const getReviewInsights = async (req, res) => {
  try {
    const filterQuery = buildFilterQuery(req.query, req.user);
    const reviews = await Review.find(filterQuery)
      .sort({ createTime: -1 })
      .limit(100); // Giới hạn 100 review mới nhất để tránh quá tải API Gemini

    if (reviews.length === 0) {
      return res.status(200).json({
        success: true,
        data: { strengths: [], painPoints: [] }
      });
    }

    const insights = await aiService.analyzeReviewInsights(reviews);

    return res.status(200).json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('❌ Lỗi getReviewInsights:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/automation/auto-reply (n8n Endpoint)
 * n8n gọi endpoint này, cung cấp reviewId, hệ thống sẽ gọi AI tạo câu trả lời và phản hồi lên Google.
 */
const autoReplyForN8N = async (req, res) => {
  try {
    const { reviewId } = req.body;
    if (!reviewId) return res.status(400).json({ success: false, message: 'Thiếu reviewId' });

    // 1. Tìm review trong DB
    const review = await Review.findOne({ googleReviewId: reviewId });
    if (!review) return res.status(404).json({ success: false, message: 'Review không tồn tại trong hệ thống' });

    if (review.replyText) {
      return res.status(400).json({ success: false, message: 'Review này đã có phản hồi rồi, bỏ qua sinh tự động.' });
    }

    // 2. Tạo phản hồi bằng AI
    console.log(`🤖 [n8n Webhook] Bắt đầu tạo phản hồi cho review: ${reviewId}`);
    const aiReply = await aiService.generateReply(review.reviewText || '', review.rating, review.reviewerName);

    // 3. Phản hồi lên Google API (Tạm mock nếu đang dùng simulate)
    const replyRes = await googleBusinessService.replyToReview(review.googleReviewId, aiReply, review.locationId);

    // 4. Lưu lại DB
    review.replyText = aiReply;
    review.status = 'AI-Replied';
    await review.save();

    console.log(`✅ [n8n Webhook] Đã phản hồi thành công lên GBP cho: ${reviewId}`);
    return res.status(200).json({
      success: true,
      data: {
        reviewId: reviewId,
        reply: aiReply,
        googleResponse: replyRes
      }
    });

  } catch (error) {
    console.error('❌ Lỗi webhook n8n autoReply:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getReviews,
  processNewReview,
  generateReplyFromAI,
  submitReply,
  testTelegramAlert,
  simulateReview,
  syncReviews,
  getReviewStats,
  getUnreadNotifications,
  markNotificationAsRead,
  exportReviews,
  getReviewInsights,
  autoReplyForN8N,
};
