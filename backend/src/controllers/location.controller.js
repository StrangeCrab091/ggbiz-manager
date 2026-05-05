const googleBusinessService = require('../services/googleBusiness.service');
const Location = require('../models/location.model');

/**
 * GET /api/locations
 * Lấy danh sách các chi nhánh (locations) mà user quản lý
 */
const getLocations = async (req, res, next) => {
  try {
    const locations = await googleBusinessService.getLocations();

    // Lưu / Cập nhật vào MongoDB
    if (locations && locations.length > 0) {
      for (const loc of locations) {
        await Location.findOneAndUpdate(
          { locationId: loc.locationId },
          { title: loc.title },
          { upsert: true, new: true }
        );
      }
    }

    // Lấy danh sách từ DB để đảm bảo trả về dữ liệu chuẩn theo Role
    let query = { locationId: { $not: /^mock_/ } }; // Bỏ qua mock locations
    if (req.user && req.user.role === 'manager') {
      query.locationId = { $in: req.user.assignedLocations || [] };
    }
    const storedLocations = await Location.find(query);

    return res.status(200).json({
      success: true,
      count: storedLocations.length,
      data: storedLocations,
    });
  } catch (error) {
    console.error('Controller Catch Lỗi:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: 'Google API Error: ' + error.message,
      details: error.details || null
    });
  }
};

/**
 * POST /api/locations/scan-grid
 * Quét lưới Local Search Grid giả lập
 */
const scanGrid = async (req, res) => {
  try {
    const { keyword, placeUrlOrId, gridSize, distance, center, gridPoints } = req.body;
    
    // Validate
    if (!keyword || !gridPoints || gridPoints.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc để quét.' });
    }

    // Danh sách tên đối thủ thực tế để giả lập khi API Google chưa gắn thật
    const realisticCompetitors = [
      'Nha khoa Paris', 'Nha khoa Kim', 'Mắt Bão', 'Tenten', 'HostVN', 
      'P.A Việt Nam', 'Viettel IDC', 'FPT Cloud', 'Highlands Coffee', 'The Coffee House',
      'Công ty Luật TNHH MTV', 'Hair Salon Bắc Trần Tiến', 'Guta Cafe', 'Thẩm Mỹ Viện Quốc Tế'
    ];

    // Tạo hàm helper để chọn random tên
    const getRandomCompetitors = () => {
      const shuffled = [...realisticCompetitors].sort(() => 0.5 - Math.random());
      return [
        { name: shuffled[0], rating: parseFloat((Math.random() * (5 - 4) + 4).toFixed(1)) },
        { name: shuffled[1], rating: parseFloat((Math.random() * (4.8 - 3.5) + 3.5).toFixed(1)) },
        { name: shuffled[2], rating: parseFloat((Math.random() * (4.5 - 3.0) + 3.0).toFixed(1)) }
      ];
    };

    // Mô phỏng quét qua từng điểm tọa độ (Gán kết quả)
    const scannedResults = gridPoints.map(point => {
      const randRank = Math.floor(Math.random() * 20) + 1; 
      let status = 'bad';
      if (randRank <= 3) status = 'top3';
      else if (randRank <= 10) status = 'top10';

      return {
        ...point,
        status,
        rank: randRank,
        competitors: getRandomCompetitors()
      };
    });

    // Mô phỏng Netowrk Timeout
    await new Promise(resolve => setTimeout(resolve, 800));

    return res.status(200).json({
      success: true,
      message: 'Quét lưới hoàn tất',
      data: {
        results: scannedResults
      }
    });

  } catch (error) {
    console.error('Lỗi API scan-grid:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi quét dữ liệu: ' + error.message
    });
  }
};

/**
 * Lấy Insights/Performance từ Google Business Profile API (30 ngày gần nhất)
 */
const getPerformance = async (req, res) => {
  try {
    const { locationId } = req.query;
    if (!locationId) return res.status(400).json({ success: false, message: 'Thiếu locationId' });

    console.log(`📡 [Performance API] Lấy dữ liệu cho chi nhánh: ${locationId}`);
    
    // Gọi service để lấy dữ liệu (SaaS flow)
    const performanceResults = await googleBusinessService.getPerformanceData(locationId);

    // Trả về theo định dạng mong muốn
    return res.status(200).json({
      success: true,
      data: performanceResults
    });

  } catch (error) {
    console.error('Lỗi API Performance:', error);
    return res.status(error.status || 500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

module.exports = {
  scanGrid,
  getLocations,
  getPerformance,
};
