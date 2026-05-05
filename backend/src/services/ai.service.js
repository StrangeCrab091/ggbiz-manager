/**
 * ai.service.js - Service xử lý AI (Phân tích cảm xúc & Tạo phản hồi tự động)
 *
 * Nguyên tắc Single Responsibility:
 * - File này chỉ chịu trách nhiệm giao tiếp với AI API
 * - Cung cấp 2 chức năng chính: phân tích cảm xúc và tạo phản hồi
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Phân tích cảm xúc của một đánh giá
 *
 * @param {string} reviewText - Nội dung đánh giá cần phân tích
 * @returns {Promise<Object>} Kết quả phân tích cảm xúc
 *   - tag: 'tích cực' | 'tiêu cực' | 'trung lập'
 *   - analysis: Mô tả chi tiết phân tích
 *   - confidence: Độ tin cậy của phân tích (0-1)
 */
/**
 * Phân tích cảm xúc của một đánh giá bằng Gemini AI (chính xác hơn từ khóa)
 */
const analyzeSentiment = async (reviewText) => {
  if (!reviewText || reviewText.trim() === '') {
    return { tag: 'trung lập', analysis: 'Không có nội dung để phân tích.', confidence: 0.5 };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Phân tích cảm xúc của đánh giá tiếng Việt sau đây.
Đánh giá: "${reviewText}"

Trả về JSON với format CHÍNH XÁC sau (không thêm gì khác):
{"tag":"tích cực|tiêu cực|trung lập","analysis":"mô tả ngắn 1 câu bằng tiếng Việt","confidence":0.0-1.0}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim()
      .replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(raw);
    const validTags = ['tích cực', 'tiêu cực', 'trung lập'];
    return {
      tag: validTags.includes(parsed.tag) ? parsed.tag : 'trung lập',
      analysis: parsed.analysis || '',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
    };
  } catch (error) {
    // Fallback sang keyword nếu AI lỗi
    const lowerText = reviewText.toLowerCase();
    const neg = ['thất vọng','kém','tệ','chậm','không hài lòng','dở','xấu','bực'].filter(k => lowerText.includes(k)).length;
    const pos = ['tuyệt vời','tốt','hài lòng','thân thiện','chuyên nghiệp','xuất sắc','nhanh'].filter(k => lowerText.includes(k)).length;
    const tag = neg > pos ? 'tiêu cực' : pos > neg ? 'tích cực' : 'trung lập';
    return { tag, analysis: 'Phân tích từ khóa (AI không khả dụng).', confidence: 0.5 };
  }
};


// Danh sách tag hợp lệ (dùng chung để validation)
const VALID_TAGS = ['Nhân viên', 'Kỹ thuật', 'Hosting', 'Tên miền', 'Khác'];

/**
 * Phân loại nội dung review vào 1 trong 5 nhóm nghiệp vụ (AI Tagging)
 * Tags: Nhân viên | Kỹ thuật | Hosting | Tên miền | Khác
 */
const categorizeReview = async (reviewText) => {
  if (!reviewText || reviewText.trim() === '' || reviewText.includes('(Chỉ đánh giá sao')) {
    return 'Khác';
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return 'Khác';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Phân loại nội dung đánh giá sau đây của khách hàng về một công ty cung cấp dịch vụ Internet/Hosting vào DUY NHẤT một trong 5 nhóm sau:
- 'Nhân viên' (nói về thái độ, giao tiếp, sự nhiệt tình, cách phục vụ của nhân viên)
- 'Kỹ thuật' (nói về hỗ trợ kỹ thuật, tổng đài, ticket, thời gian giải quyết sự cố)
- 'Hosting' (nói về máy chủ, VPS, Cloud, uptime, tốc độ tải, băng thông)
- 'Tên miền' (nói về đăng ký/gia hạn/chuyển domain, giá domain, DNS)
- 'Khác' (tất cả trường hợp còn lại)

Nội dung đánh giá: "${reviewText}"

Chỉ trả về DUY NHẤT một trong 5 từ khóa: Nhân viên, Kỹ thuật, Hosting, Tên miền, Khác. Không thêm gì khác.`;

    const result = await model.generateContent(prompt);
    const rawTag = result.response.text().trim();
    // Validate kết quả, nếu AI trả về ngoài danh sách thì fallback về 'Khác'
    return VALID_TAGS.includes(rawTag) ? rawTag : 'Khác';
  } catch (error) {
    console.error('❌ Lỗi AI Categorize:', error.message);
    return 'Khác';
  }
};

/**
 * Tạo phản hồi tự động cho đánh giá bằng AI
 *
 * @param {string} reviewText - Nội dung đánh giá
 * @param {number} rating - Số sao đánh giá (1-5)
 * @param {string} reviewerName - Tên người đánh giá
 * @returns {Promise<string>} Nội dung phản hồi được AI tạo ra
 */
const generateReply = async (reviewText, rating, reviewerName, customPrompt = '') => {
  console.log(`🤖 AI đang tạo phản hồi cho ${reviewerName || 'Khách hàng'} (Rating: ${rating})...`);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Thiếu cấu hình GEMINI_API_KEY trong file .env');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = `Bạn là chuyên viên chăm sóc khách hàng cao cấp tại Mắt Bão - nhà cung cấp giải pháp Hạ tầng Internet hàng đầu (Domain, Hosting, Cloud Server, Email Pro). 

Dưới đây là thông tin từ khách hàng trên Google Maps:
- Số sao: ${rating} ⭐
- Tên khách hàng: ${reviewerName || 'Quý khách'}
- Nội dung đánh giá: "${reviewText}"

Nhiệm vụ của bạn là viết một phản hồi phản ánh đúng giá trị "Tận tâm - Chuyên nghiệp" của Mắt Bão theo các quy tắc sau:

1. ĐỐI VỚI ĐÁNH GIÁ 4-5 SAO (Tích cực):
   - Bắt đầu bằng lời cảm ơn chân thành và gọi tên khách hàng (nếu có).
   - Nếu khách khen cụ thể (về hạ tầng, tốc độ, hoặc hỗ trợ kỹ thuật), hãy nhắc lại điểm đó để khẳng định chúng ta đã lắng nghe.
   - Kết thúc bằng lời chúc công việc kinh doanh của khách hàng phát triển thuận lợi trên nền tảng của Mắt Bão.

2. ĐỐI VỚI ĐÁNH GIÁ 1-3 SAO (Cần xử lý):
   - Tuyệt đối không tranh cãi. Hãy thể hiện sự cầu thị và nhận lỗi về trải nghiệm chưa tốt của khách.
   - Không hứa suông. Hãy mời khách cung cấp mã số hỗ trợ (Ticket) hoặc liên hệ Hotline 1900 1830 (nhánh kỹ thuật) để được xử lý ưu tiên.
   - Cam kết sẽ chuyển thông tin này cho bộ phận liên quan để cải tiến ngay lập tức.

3. QUY TẮC VỀ GIỌNG ĐIỆU (Tone of Voice):
   - Ngôn ngữ: Tiếng Việt tự nhiên, ấm áp, tránh dùng các từ máy móc như "Chúng tôi đã nhận được tin".
   - Tuyệt đối không lặp lại nguyên văn các câu trả lời trước đó (tạo sự biến chuyển linh hoạt).
   - Độ dài: Ngắn gọn, súc tích (khoảng 2-3 câu).

Hãy trả lời trực tiếp nội dung phản hồi, không thêm bất kỳ dẫn giải nào khác.
`;

    if (customPrompt && customPrompt.trim() !== '') {
      prompt += `\n4. QUY TẮC ƯU TIÊN HÀNG ĐẦU (PHẢI TUÂN THỦ TUYỆT ĐỐI):\n${customPrompt}\n`;
      prompt += `Nếu quy tắc ưu tiên này có mâu thuẫn với các hướng dẫn tổng quát ở trên, hãy thực hiện theo QUY TẮC ƯU TIÊN này.`;
    }

    prompt += `\n\nHãy viết nội dung phản hồi ngay lập tức (không giải thích thêm):`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    console.log('--- 🛑 KẾT QUẢ AI SINH RA DƯỚI BACKEND ---');
    console.log(responseText);
    console.log('-------------------------------------------');
    
    return responseText;
  } catch (error) {
    console.error('❌ Lỗi tạo phản hồi AI:', error.message);
    throw new Error('Lỗi từ Gemini AI: ' + error.message);
  }
};

/**
 * Phân tích Insight khách hàng (Điểm mạnh & Vấn đề) từ danh sách review
 */
const analyzeReviewInsights = async (reviews) => {
  console.log(`🤖 AI đang phân tích insight từ ${reviews.length} đánh giá...`);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Thiếu cấu hình GEMINI_API_KEY');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const reviewTexts = reviews.map(r => `- ${r.rating} sao: ${r.reviewText || '(không bình luận)'}`).join('\n');

    const prompt = `Hãy phân tích các đánh giá sau đây. Trả về DUY NHẤT một chuỗi JSON hợp lệ với cấu trúc: {"strengths": [{"topic": "chủ đề", "percentage": "10%", "summary": "tóm tắt"}], "painPoints": [{"topic": "vấn đề", "percentage": "20%", "summary": "tóm tắt"}]}. Không kèm theo bất kỳ văn bản nào khác, không dùng markdown code block.

Dữ liệu:
${reviewTexts}`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    // Xóa bỏ wrapper markdown nếu AI vẫn trả về
    responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    return JSON.parse(responseText);
  } catch (error) {
    console.error('❌ Lỗi AI Insights:', error.message);
    throw new Error('Lỗi phân tích Insights AI: ' + error.message);
  }
};

/**
 * Phân tích Insight Đối thủ
 */
const analyzeCompetitorInsights = async (reviews) => {
  console.log(`🤖 AI đang phân tích insight đối thủ từ ${reviews.length} đánh giá...`);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Thiếu cấu hình GEMINI_API_KEY');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const reviewTexts = reviews.map(r => `- ${r}`).join('\n');

    const prompt = `Đây là các đánh giá công khai về một công ty ĐỐI THỦ của Mắt Bão. Hãy phân tích và trả về JSON gồm 2 mảng: weaknesses (Những điểm khách hàng đang chê/bức xúc) và opportunities (Cách sale Mắt Bão có thể tư vấn để kéo khách này về, ví dụ: nhấn mạnh vào hạ tầng, support 24/7...). 

Mỗi item trong weaknesses và opportunities gồm: topic (chủ đề ngắn gọn), percentage (tỷ lệ % ước lượng xuất hiện), summary (câu tóm tắt giải thích).

Chỉ trả về JSON thuần hợp lệ (không chứa markdown, không markdown block \`\`\`).

Dữ liệu đánh giá đối thủ:
${reviewTexts}`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    // Xóa bỏ wrapper markdown nếu AI vẫn trả về
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json\n/g, '').replace(/\n```/g, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```/g, '');
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error('❌ Lỗi AI Đối thủ:', error.message);
    throw new Error('Lỗi phân tích AI đối thủ: ' + error.message);
  }
};

/**
 * Tạo bản thảo khiếu nại review (Dispute Draft) bằng tiếng Anh để gửi Google Support
 */
const generateDisputeDraft = async (reviewText, reviewerName) => {
  console.log(`🤖 AI đang soạn thảo đơn khiếu nại cho review từ: ${reviewerName}...`);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Bạn là chuyên gia về chính sách của Google Business Profile. 
Hãy soạn một đoạn văn bằng tiếng Anh chuyên nghiệp và thuyết phục để gửi cho bộ phận Google Support nhằm khiếu nại (Report) và yêu cầu gỡ bỏ một review vi phạm.

THÔNG TIN REVIEW VI PHẠM:
- Tên khách hàng: ${reviewerName}
- Nội dung: "${reviewText || '(không có nội dung)'}"

YÊU CẦU:
1. Ngôn ngữ: Tiếng Anh trang trọng.
2. Nội dung: Phân tích tại sao review này vi phạm chính sách của Google (ví dụ: Fake content, Spam, Harassment, Conflict of Interest). Hãy giả định đây là một đợt tấn công bẩn dựa trên mật độ review 1 sao bất thường.
3. Cấu trúc: Ngắn gọn, súc tích, đi thẳng vào vấn đề vi phạm chính sách.

Chỉ trả về đoạn văn tiếng Anh để Copy-Paste, không thêm lời dẫn giải.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('❌ Lỗi AI Dispute Draft:', error.message);
    throw new Error('Lỗi từ AI: ' + error.message);
  }
};

/**
 * Phân tích các review xấu và đề xuất 3 giải pháp cải thiện cụ thể
 */
const generateAISolutions = async (reviews) => {
  console.log(`🤖 AI đang tìm giải pháp từ ${reviews.length} đánh giá tiêu cực...`);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const reviewTexts = reviews.map(r => `- ${r.rating} sao: ${r.reviewText || '(không bình luận)'}`).join('\n');

    const prompt = `Dưới đây là danh sách các đánh giá tiêu cực (1-3 sao) của khách hàng về dịch vụ của chúng tôi.
Hãy phân tích kỹ các đánh giá này và trả về JSON với format (không markdown, không giải thích thêm):
{
  "summary": "Tóm tắt ngắn gọn tình hình hiện tại (1 câu)",
  "problems": ["Vấn đề 1", "Vấn đề 2", "Vấn đề 3"],
  "actions": ["Hành động khắc phục 1", "Hành động khắc phục 2", "Hành động khắc phục 3"]
}

Dữ liệu:
${reviewTexts}`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    return JSON.parse(responseText);
  } catch (error) {
    console.error('❌ Lỗi AI Solutions:', error.message);
    throw new Error('Lỗi phân tích giải pháp AI: ' + error.message);
  }
};

module.exports = {
  analyzeSentiment,
  categorizeReview,
  generateReply,
  analyzeReviewInsights,
  analyzeCompetitorInsights,
  generateDisputeDraft,
  generateAISolutions,
};

/**
 * Tính Popularity Score dựa trên số lượng review và rating
 * Công thức: (rating * log10(reviewCount + 1)) chuẩn hóa về thang 0-100
 */
const computePopularityScore = (rating, userRatingCount) => {
  const raw = rating * Math.log10(userRatingCount + 1);
  // Chuẩn hóa: max thực tế ≈ 5 * log10(10001) ≈ 20 → scale về 100
  const score = Math.min(100, Math.round((raw / 20) * 100));
  return score;
};

/**
 * Phân tích Radar nâng cấp: Gap Analysis theo ngành + chiến lược AI
 * @param {string} reviewTexts - Văn bản review gộp từ nhiều đối thủ
 * @param {string} industry - Ngành nghề (fb, retail, tech, ...)
 */
const analyzeRadarInsights = async (reviewTexts, industry = 'general') => {
  console.log(`🤖 AI đang phân tích Radar (Ngành: ${industry})...`);

  const industryContext = {
    fb: `Ngành F&B (Nhà hàng / Cafe / Đồ uống). Tập trung phân tích: hương vị món ăn/đồ uống, không gian ngồi & ánh sáng, thái độ phục vụ, tốc độ ra món, giá cả/menu, chỗ để xe, wifi & tiện nghi.`,
    retail: `Ngành bán lẻ (Cửa hàng tiện lợi / Siêu thị mini). Tập trung: đa dạng hàng hóa, giá niêm yết, bố trí cửa hàng, chính sách đổi trả, nhân viên tư vấn, thanh toán nhanh.`,
    tech: `Ngành Công nghệ / Dịch vụ IT. Tập trung: tốc độ hỗ trợ kỹ thuật, chất lượng sản phẩm, uptime/hiệu suất, tư vấn trước bán hàng, phản hồi sau bán hàng.`,
    beauty: `Ngành Làm đẹp (Spa / Salon / Thẩm mỹ). Tập trung: tay nghề kỹ thuật viên, vệ sinh & an toàn, đặt lịch hẹn, không gian thư giãn, giá dịch vụ, kết quả thực tế sau trị liệu.`,
    edu: `Ngành Giáo dục / Đào tạo. Tập trung: chất lượng giáo viên, tài liệu học tập, cơ sở vật chất, chi phí học phí, kết quả đầu ra, hỗ trợ học viên.`,
    general: `Ngành dịch vụ tổng quát. Phân tích từ góc độ khách quan, đa chiều.`,
  };

  const industryHint = industryContext[industry] || industryContext['general'];

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Thiếu cấu hình GEMINI_API_KEY');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Bạn là chuyên gia phân tích chiến lược thị trường. Dưới đây là review của các đối thủ trong khu vực.

BỐI CẢNH NGÀNH NGHỀ: ${industryHint}

Nhiệm vụ: Phân tích dữ liệu và trả về JSON với CẤU TRÚC CHÍNH XÁC sau:
{
  "summary": "1 câu tóm tắt bức tranh cạnh tranh tổng thể",
  "gapAnalysis": {
    "product": { "weaknesses": ["điểm yếu 1", "điểm yếu 2"], "opportunity": "cơ hội khai thác" },
    "price": { "weaknesses": ["điểm yếu về giá"], "opportunity": "cơ hội khai thác" },
    "space": { "weaknesses": ["điểm yếu không gian"], "opportunity": "cơ hội khai thác" },
    "service": { "weaknesses": ["điểm yếu dịch vụ"], "opportunity": "cơ hội khai thác" }
  },
  "topWeakness": "Điểm yếu PHỔ BIẾN NHẤT của tất cả đối thủ (1 câu súc tích, có số liệu nếu có)",
  "marketingCampaign": { "title": "Tiêu đề chiến dịch", "angle": "Góc độ tấn công thị trường", "message": "Thông điệp marketing cụ thể dựa trên lỗ hổng đối thủ" },
  "strategies": [
    { "title": "Tiêu đề ngắn", "detail": "Kế hoạch hành động chi tiết" }
  ]
}

Dữ liệu review đối thủ:
${reviewTexts}

Chỉ trả về JSON thuần hợp lệ (không markdown \`\`\`json).`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json\n?/g, '').replace(/\n?```/g, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```/g, '');
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error('❌ Lỗi AI Radar Insights:', error.message);
    throw new Error('Lỗi phân tích AI Radar: ' + error.message);
  }
};

module.exports = {
  analyzeSentiment,
  categorizeReview,
  generateReply,
  analyzeReviewInsights,
  analyzeCompetitorInsights,
  generateDisputeDraft,
  generateAISolutions,
  analyzeRadarInsights,
  computePopularityScore,
};

