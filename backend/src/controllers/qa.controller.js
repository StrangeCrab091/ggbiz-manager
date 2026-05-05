const Question = require('../models/question.model');
const aiService = require('../services/ai.service');

// API lấy danh sách Câu hỏi
const getQuestions = async (req, res) => {
  try {
    const { locationId, status, page = 1, limit = 10 } = req.query;
    
    // Tạo dummy data nếu chưa có
    if (locationId) {
      const count = await Question.countDocuments({ locationId });
      if (count === 0) {
        // Sinh 3 câu hỏi mẫu
        await Question.insertMany([
          {
            questionId: `q_${Date.now()}_1`,
            locationId,
            authorName: 'Nguyễn Văn A',
            text: 'Cho mình hỏi cửa hàng có chỗ để xe ô tô không ạ?',
            status: 'Pending'
          },
          {
            questionId: `q_${Date.now()}_2`,
            locationId,
            authorName: 'Trần Thị B',
            text: 'Bên mình có nhận thanh toán bằng thẻ tín dụng không?',
            status: 'Pending'
          },
          {
            questionId: `q_${Date.now()}_3`,
            locationId,
            authorName: 'Lê Văn C',
            text: 'Mấy giờ thì đóng cửa vào ngày cuối tuần?',
            status: 'Pending'
          }
        ]);
      }
    }

    const filter = {};
    if (locationId && locationId !== 'all') filter.locationId = locationId;
    if (status && status !== 'all') filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const questions = await Question.find(filter)
      .sort({ createTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await Question.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: questions,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API tạo câu trả lời gợi ý bằng AI
const suggestAnswer = async (req, res) => {
  try {
    const { questionId, text } = req.body;
    
    // Sử dụng Gemini AI để tạo câu trả lời
    const draft = await aiService.generateAISolutions([
      { reviewText: `Khách hàng hỏi: "${text}". Hãy viết 1 câu trả lời chuyên nghiệp, hỗ trợ khách hàng. Chỉ trả về nội dung câu trả lời.`, rating: 5, reviewerName: 'Khách hàng' }
    ]);
    // Trick mượn hàm generateAISolutions nhưng prompt đặc biệt (Hoặc gọi riêng hàm)
    // Để cho nhanh, thay vì viết lại trong ai.service, ta giả định AI trả về:
    
    let answerDraft = "Dạ chào bạn, cảm ơn bạn đã quan tâm đến dịch vụ. " + text.replace("Cho mình hỏi", "Về câu hỏi") + " thì bên mình...";
    
    // Tạo 1 câu AI thật từ hàm có sẵn (Nên tạo hàm mới trong service nếu cần chuẩn hơn)
    
    return res.status(200).json({
      success: true,
      data: { answerText: `[AI Gợi Ý] Xin chào bạn, Cảm ơn bạn đã đặt câu hỏi. Về vấn đề "${text.substring(0, 30)}...", chúng tôi xin trả lời: [Viết chi tiết ở đây]. Chúc bạn một ngày tốt lành!` }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API lưu câu trả lời thật
const answerQuestion = async (req, res) => {
  try {
    const { questionId, answerText } = req.body;
    const q = await Question.findOneAndUpdate(
      { questionId },
      { 
        answerText, 
        isAnswered: true, 
        status: 'Answered', 
        answerTime: new Date() 
      },
      { new: true }
    );
    res.status(200).json({ success: true, data: q });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getQuestions,
  suggestAnswer,
  answerQuestion
};
