const SpamAlert = require('../models/spamAlert.model');
const Review = require('../models/review.model');
const aiService = require('../services/ai.service');

/**
 * GET /api/spam/alerts
 * Lấy danh sách cảnh báo spam (chưa xử lý)
 */
const getActiveAlerts = async (req, res) => {
  try {
    const { locationId } = req.query;
    const query = { isResolved: false };
    
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
    } else if (locationId && locationId !== 'all') {
      query.locationId = locationId;
    }

    const alerts = await SpamAlert.find(query).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/spam/alerts/:id/resolve
 * Đánh dấu đã xử lý
 */
const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    await SpamAlert.findByIdAndUpdate(id, { isResolved: true });
    return res.status(200).json({ success: true, message: 'Đã đánh dấu xử lý' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/spam/report-review/:id
 * Đánh dấu review này đang bị khiếu nại (Reporting)
 */
const handleReportReview = async (req, res) => {
  try {
    const { id } = req.params; // Google Review ID
    const updated = await Review.findOneAndUpdate(
      { $or: [{ googleReviewId: id }, { _id: id }] },
      { status: 'Reporting' },
      { new: true }
    );
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/spam/dispute-draft
 * Soạn thảo nội dung giải trình khiếu nại bằng AI
 */
const handleGetDisputeDraft = async (req, res) => {
  try {
    const { reviewText, reviewerName } = req.body;
    const draft = await aiService.generateDisputeDraft(reviewText, reviewerName);
    return res.status(200).json({ success: true, data: draft });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getActiveAlerts,
  resolveAlert,
  handleReportReview,
  handleGetDisputeDraft
};
