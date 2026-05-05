const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AutoReplyRule = require('../src/models/autoReplyRule.model');

dotenv.config();

const seedRules = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Đã kết nối MongoDB để Seed dữ liệu.');

        // Xóa các quy tắc cũ (nếu muốn làm sạch)
        // await AutoReplyRule.deleteMany({});

        const defaultRule = {
            name: 'Tự động cảm ơn 5 sao (Không lời nhắn)',
            minStars: 5,
            maxStars: 5,
            conditionHasText: 'no_text',
            delayMinutes: 5,
            isActive: true
        };

        const existing = await AutoReplyRule.findOne({ name: defaultRule.name });
        if (!existing) {
            await AutoReplyRule.create(defaultRule);
            console.log('✅ Đã thêm quy tắc mặc định thành công!');
        } else {
            console.log('ℹ️ Quy tắc mặc định đã tồn tại.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi Seed Rule:', error);
        process.exit(1);
    }
};

seedRules();
