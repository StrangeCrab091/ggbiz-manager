const competitorService = require('../services/competitor.service');
const aiService = require('../services/ai.service');

const searchCompetitor = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Thiếu link hoặc tên đối thủ cần tìm' });
    }

    console.log(`[Competitor] Bắt đầu tìm kiếm đối thủ: ${query}`);
    
    // 1. Tìm thông tin từ Google Places API (Hỗ trợ cả Tên và URL Google Maps)
    const competitorData = await competitorService.searchCompetitorReviews(query);
    
    if (!competitorData) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đối thủ này trên Google Maps' });
    }

    return res.status(200).json({
      success: true,
      data: competitorData
    });
  } catch (error) {
    console.error('❌ Lỗi searchCompetitor:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const analyzeCompetitor = async (req, res) => {
  try {
    const { reviews, competitorInfo } = req.body;
    
    if (!reviews || !competitorInfo) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu review hoặc thông tin đối thủ để phân tích' });
    }

    if (reviews.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'Đối thủ này không có đánh giá để phân tích',
        data: {
           competitorInfo: competitorInfo,
           insights: { weaknesses: [], opportunities: [] }
        }
      });
    }

    console.log(`[Competitor] Phân tích AI ${reviews.length} đánh giá của ${competitorInfo.displayName}...`);
    
    // Phân tích AI từ các review
    const insights = await aiService.analyzeCompetitorInsights(reviews);

    return res.status(200).json({
      success: true,
      data: {
        competitorInfo: competitorInfo,
        insights: insights
      }
    });

  } catch (error) {
    console.error('❌ Lỗi analyzeCompetitor:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const radarSearch = async (req, res) => {
  try {
    const { source, keyword, radius, industry = 'general' } = req.body;
    if (!source || !keyword) {
      return res.status(400).json({ success: false, message: 'Thiếu link/tên nguồn hoặc từ khóa mục tiêu' });
    }

    console.log(`[Competitor Radar] Tìm nguồn: ${source}`);
    // 1. Lấy vị trí của nguồn
    const sourceData = await competitorService.searchCompetitorReviews(source);
    if (!sourceData || !sourceData.location) {
      return res.status(404).json({ success: false, message: 'Không thể định vị nguồn (location) trên Google Maps.' });
    }

    console.log(`[Competitor Radar] Nguồn ở vị trí: ${sourceData.location.latitude}, ${sourceData.location.longitude}`);
    console.log(`[Competitor Radar] Tìm đối thủ keyword "${keyword}" trong bán kính ${radius}m, ngành: ${industry}...`);

    // 2. Tìm đối thủ trong bán kính
    let competitors = await competitorService.searchRadar(sourceData.location, radius, keyword);

    // 3. Tính popularityScore cho từng đối thủ
    competitors = competitors.map(c => ({
      ...c,
      popularityScore: aiService.computePopularityScore(c.rating, c.userRatingCount),
    }));

    // 4. Sắp xếp theo popularityScore và lấy Top 5 có review
    let topCompetitors = [...competitors]
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 5)
      .filter(c => c.reviews.length > 0 && c.id !== sourceData.id);

    let aiAnalysis = null;
    if (topCompetitors.length > 0) {
      // Gộp reviews của top đối thủ
      const textToAnalyze = topCompetitors
        .map(c => `[Đối thủ ${c.displayName} — ${c.rating}⭐ (${c.userRatingCount} reviews)]:\n` + c.reviews.slice(0, 5).join('\n---\n'))
        .join('\n\n');
      
      try {
        aiAnalysis = await aiService.analyzeRadarInsights(textToAnalyze, industry);
      } catch (e) {
        console.error('Lỗi khi gọi AI phân tích Radar:', e);
        aiAnalysis = { summary: 'Không thể phân tích dữ liệu AI vào lúc này. Vui lòng thử lại sau.' };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        source: { ...sourceData, popularityScore: aiService.computePopularityScore(sourceData.rating, sourceData.userRatingCount) },
        competitors: competitors,
        topCompetitors: topCompetitors,
        aiAnalysis: aiAnalysis
      }
    });
  } catch (error) {
    console.error('❌ Lỗi radarSearch:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  searchCompetitor,
  analyzeCompetitor,
  radarSearch
};
