const cron = require('node-cron');
const Review = require('../models/review.model');
const AutoReplyRule = require('../models/autoReplyRule.model');
const aiService = require('./ai.service');
const googleBusinessService = require('./googleBusiness.service');

/**
 * 🤖 AutoPilot Worker - "Bộ não" chạy ngầm xử lý phản hồi tự động
 * Tần suất: 5 phút một lần
 */
const startAutoPilot = () => {
    // Chạy mỗi 1 phút (Để test)
    cron.schedule('* * * * *', async () => {
        console.log(`\n🤖 [AutoPilot] Đang quét các đánh giá chưa phản hồi (${new Date().toLocaleTimeString()})...`);

        try {
            // 1. Lấy tất cả các quy tắc đang hoạt động
            const rules = await AutoReplyRule.find({ isActive: true });
            if (rules.length === 0) {
                console.log('   - Không có quy tắc tự động nào đang hoạt động.');
                return;
            }

            // 2. Tìm các review CHƯA PHẢN HỒI (replyText trống)
            // Lọc các review thực (bắt đầu bằng real_ hoặc accounts/) hoặc review simulation nhưng status là Pending
            const pendingReviews = await Review.find({
                $or: [
                    { replyText: null },
                    { replyText: '' }
                ],
                status: { $in: ['Pending', 'Processed', 'Alert-Sent'] }
            });

            if (pendingReviews.length === 0) {
                console.log('   - Không có đánh giá nào cần xử lý.');
                return;
            }

            console.log(`   - Tìm thấy ${pendingReviews.length} đánh giá tiềm năng.`);

            for (const review of pendingReviews) {
                // 3. Đối chiếu từng Review với danh sách Quy tắc
                const matchedRule = rules.find(rule => {
                    // Check số sao
                    const starsMatch = review.rating >= rule.minStars && review.rating <= rule.maxStars;
                    if (!starsMatch) return false;

                    // Check điều kiện có text hay không
                    const hasText = review.reviewText && review.reviewText.trim().length > 0 
                        && review.reviewText !== '(Chỉ đánh giá sao, không có bình luận)'
                        && review.reviewText !== '(Đánh giá 5 sao không kèm bình luận)'
                        && review.reviewText !== '(Đánh giá 1 sao không kèm bình luận)';
                    if (rule.conditionHasText === 'has_text' && !hasText) return false;
                    if (rule.conditionHasText === 'no_text' && hasText) return false;

                    // Check Delay
                    const waitTimeMs = rule.delayMinutes * 60 * 1000;
                    const reviewTime = new Date(review.createTime || review.createdAt).getTime();
                    const now = Date.now();
                    
                    if (now - reviewTime < waitTimeMs) {
                        const remainingSec = Math.ceil((waitTimeMs - (now - reviewTime)) / 1000);
                        console.log(`   ⏳ Review của [${review.reviewerName}] đang chờ delay (Còn ${remainingSec}s)...`);
                        return false; // Chưa đến lúc trả lời
                    }

                    return true;
                });

                if (matchedRule) {
                    console.log(`   ✨ Đã khớp quy tắc [${matchedRule.name}] cho review của: ${review.reviewerName}`);
                    
                    try {
                        // 4. Gọi AI tạo câu trả lời
                        const aiReply = await aiService.generateReply(
                            review.reviewText,
                            review.rating,
                            review.reviewerName,
                            matchedRule.aiPrompt
                        );

                        if (aiReply) {
                            // 5. Đăng phản hồi lên Google (nếu là review thật)
                            const isReal = review.googleReviewId && 
                                           !review.googleReviewId.startsWith('mock_') && 
                                           !review.googleReviewId.startsWith('sim_') &&
                                           review.locationId && 
                                           !review.locationId.startsWith('mock_') && 
                                           review.locationId !== 'default' &&
                                           review.locationId !== 'demo-id';
                            
                            let pushedToGoogle = false;
                            if (isReal) {
                                try {
                                    await googleBusinessService.replyToReview(review.googleReviewId, aiReply, review.locationId);
                                    pushedToGoogle = true;
                                    console.log(`   🌐 [AutoPilot] Đã đẩy phản hồi lên Google Maps cho: ${review.reviewerName}`);
                                } catch (googleErr) {
                                    console.error(`   ❌ [AutoPilot] Lỗi đẩy Google cho ${review.reviewerName}:`, googleErr.message);
                                }
                            } else {
                                console.log(`   📝 (Simulation) Đã giả lập phản hồi cho review ID: ${review._id}`);
                            }

                            // 6. Cập nhật Database (đầy đủ - giống submitReply)
                            review.replyText = aiReply;
                            review.reply_content = aiReply;
                            review.replied_at = new Date();
                            review.status = 'Auto-Replied';
                            await review.save();

                            console.log(`   ✅ Đã tự động phản hồi thành công cho [${review.reviewerName}] (Google: ${pushedToGoogle ? 'OK' : 'Bỏ qua/Lỗi'})`);
                        }
                    } catch (replyErr) {
                        console.error(`   ❌ Lỗi khi xử lý phản hồi tự động cho ${review._id}:`, replyErr.message);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Lỗi hệ thống AutoPilot Worker:', error);
        }
    });

    console.log('🚀 AutoPilot Worker đã được kích hoạt (Chế độ Test: Quét mỗi 1 phút).');
};

module.exports = { startAutoPilot };
