const AutoReplyRule = require('../models/autoReplyRule.model');

// Lấy danh sách quy tắc
const getRules = async (req, res) => {
  try {
    const rules = await AutoReplyRule.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo quy tắc mới
const createRule = async (req, res) => {
  try {
    const rule = await AutoReplyRule.create(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Cập nhật trạng thái bật/tắt
const updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await AutoReplyRule.findByIdAndUpdate(id, req.body, { new: true });
    if (!rule) return res.status(404).json({ success: false, message: 'Không tìm thấy quy tắc' });
    res.status(200).json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Xóa quy tắc
const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    await AutoReplyRule.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Đã xóa quy tắc' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRules,
  createRule,
  updateRule,
  deleteRule
};
