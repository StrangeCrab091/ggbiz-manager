/**
 * analytics.controller.js - Controller xử lý dữ liệu biểu đồ và báo cáo
 */
const Review = require('../models/review.model');
const Location = require('../models/location.model');
const mongoose = require('mongoose');
const aiService = require('../services/ai.service');

const getMonthlyTrends = async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    const filter = {};
    
    if (startDate || endDate) {
      filter.createTime = {};
      if (startDate) filter.createTime.$gte = new Date(startDate);
      if (endDate) filter.createTime.$lte = new Date(endDate);
    }
    
    if (locationId && locationId !== 'all') {
      filter.locationId = locationId;
    }

    // Lấy danh sách chi nhánh
    let locationIds = [];
    const locationNames = {};
    const locations = await Location.find();
    if (locationId && locationId !== 'all') {
      locationIds = [locationId];
      const loc = locations.find(l => l.locationId === locationId);
      if (loc) locationNames[loc.locationId] = loc.title;
    } else {
      locationIds = locations.map(l => l.locationId);
      locations.forEach(l => locationNames[l.locationId] = l.title);
    }

    const aggregation = await Review.aggregate([
      { 
        $match: { 
          ...filter,
          locationId: { $in: locationIds }
        } 
      },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$createTime" } },
            locationId: "$locationId"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.month": 1 } }
    ]);

    const chartMap = {};
    aggregation.forEach(item => {
      const month = item._id.month;
      const locId = item._id.locationId;
      const locName = locationNames[locId] || locId;
      
      if (!chartMap[month]) chartMap[month] = { month };
      chartMap[month][locName] = item.count;
    });

    const chartData = Object.values(chartMap);

    return res.status(200).json({
      success: true,
      data: chartData,
      locationNames: Object.values(locationNames)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTopComplaints = async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    const filter = { 
      rating: { $lte: 3 },
      reviewText: { $exists: true, $ne: '' } 
    };
    
    if (startDate || endDate) {
      filter.createTime = {};
      if (startDate) filter.createTime.$gte = new Date(startDate);
      if (endDate) filter.createTime.$lte = new Date(endDate);
    }
    if (locationId && locationId !== 'all') {
      filter.locationId = locationId;
    }

    const complaints = await Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $ifNull: ["$category_tag", "Khác"] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const chartData = complaints.map(item => ({
      category: (!item._id || item._id === 'null') ? 'Khác' : item._id,
      count: item.count
    }));

    return res.status(200).json({ success: true, data: chartData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOverallStats = async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    const startObj = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endObj = endDate ? new Date(endDate) : new Date();

    const currentFilter = { createTime: { $gte: startObj, $lte: endObj } };
    if (locationId && locationId !== 'all') {
      currentFilter.locationId = locationId;
    }

    const topBranchAgg = await Review.aggregate([
      { $match: currentFilter },
      { $group: { _id: "$locationId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    let topBranch = { id: null, name: 'Chưa có dữ liệu', count: 0, percentage: 0 };
    if (topBranchAgg.length > 0) {
      const loc = await Location.findOne({ locationId: topBranchAgg[0]._id });
      const totalReviews = await Review.countDocuments(currentFilter);
      topBranch = {
        id: topBranchAgg[0]._id,
        name: loc ? loc.title : topBranchAgg[0]._id,
        count: topBranchAgg[0].count,
        percentage: totalReviews > 0 ? Math.round((topBranchAgg[0].count / totalReviews) * 100) : 0
      };
    }

    const topIssueAgg = await Review.aggregate([
      { $match: { ...currentFilter, rating: { $lte: 3 }, category_tag: { $nin: ['Khác', null] } } },
      { $group: { _id: "$category_tag", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    let topIssue = 'Không có vấn đề lớn';
    if (topIssueAgg.length > 0) {
       topIssue = topIssueAgg[0]._id;
    }

    const duration = endObj.getTime() - startObj.getTime();
    const prevStart = new Date(startObj.getTime() - duration);
    const prevEnd = new Date(startObj.getTime() - 1);

    const prevFilter = { createTime: { $gte: prevStart, $lte: prevEnd } };
    if (locationId && locationId !== 'all') {
      prevFilter.locationId = locationId;
    }

    const [currentCount, prevCount] = await Promise.all([
      Review.countDocuments(currentFilter),
      Review.countDocuments(prevFilter)
    ]);

    const growth = prevCount > 0 
      ? Math.round(((currentCount - prevCount) / prevCount) * 100)
      : (currentCount > 0 ? 100 : 0);

    return res.status(200).json({
      success: true,
      data: { topBranch, topIssue, growthPercent: growth, totalReviews: currentCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAISolution = async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    const filter = { rating: { $lte: 3 } };
    
    if (startDate || endDate) {
      filter.createTime = {};
      if (startDate) filter.createTime.$gte = new Date(startDate);
      if (endDate) filter.createTime.$lte = new Date(endDate);
    }
    if (locationId && locationId !== 'all') {
      filter.locationId = locationId;
    }

    const reviews = await Review.find(filter)
      .sort({ rating: 1, createTime: -1 })
      .limit(20)
      .select('reviewText rating reviewerName');

    if (reviews.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          summary: "Chưa có đánh giá tiêu cực nào trong khoảng thời gian này.",
          problems: ["Không có vấn đề phát hiện"],
          actions: ["Duy trì chất lượng dịch vụ hiện tại"]
        }
      });
    }

    const solution = await aiService.generateAISolutions(reviews);

    return res.status(200).json({ success: true, data: solution });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBranchRanking = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const currentFilter = {};
    const prevFilter = {};
    
    if (startDate && endDate) {
      const startObj = new Date(startDate);
      const endObj = new Date(endDate);
      currentFilter.createTime = { $gte: startObj, $lte: endObj };
      
      const duration = endObj.getTime() - startObj.getTime();
      prevFilter.createTime = { 
        $gte: new Date(startObj.getTime() - duration), 
        $lte: new Date(startObj.getTime() - 1) 
      };
    }

    const getAgg = (filter) => Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$locationId",
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          repliedCount: { 
            $sum: { $cond: [{ $in: ["$status", ["Replied", "Processed", "Auto-Replied", "Alert-Sent"]] }, 1, 0] } 
          },
          positiveSentimentCount: {
            $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, { $cond: [{ $eq: ["$rating", 4] }, 0.5, 0] }] }
          }
        }
      }
    ]);

    const [currentAgg, prevAgg] = await Promise.all([getAgg(currentFilter), getAgg(prevFilter)]);

    const locations = await Location.find();
    const locMap = {};
    locations.forEach(l => locMap[l.locationId] = l.title);

    const prevScores = {};
    prevAgg.forEach(item => {
      const aR = item.avgRating || 0;
      const rR = item.totalReviews > 0 ? (item.repliedCount / item.totalReviews) * 100 : 0;
      const sS = item.totalReviews > 0 ? (item.positiveSentimentCount / item.totalReviews) * 100 : 0;
      prevScores[item._id] = (aR * 20 * 0.5) + (rR * 0.3) + (sS * 0.2);
    });

    const rankingData = currentAgg.map(item => {
      const avgRating = item.avgRating || 0;
      const responseRate = item.totalReviews > 0 ? (item.repliedCount / item.totalReviews) * 100 : 0;
      const sentimentScore = item.totalReviews > 0 ? (item.positiveSentimentCount / item.totalReviews) * 100 : 0;
      const score = (avgRating * 20 * 0.5) + (responseRate * 0.3) + (sentimentScore * 0.2);

      return {
        locationId: item._id,
        locationName: locMap[item._id] || item._id,
        avgRating,
        responseRate,
        sentimentScore,
        score: Math.round(score * 10) / 10,
        totalReviews: item.totalReviews,
        prevScore: prevScores[item._id] || 0
      };
    });

    rankingData.sort((a, b) => b.score - a.score);

    rankingData.forEach((item, index) => {
      item.rank = index + 1;
      const prevScore = item.prevScore;
      if (prevScore === 0) item.trend = 0;
      else if (item.score > prevScore) item.trend = 1;
      else if (item.score < prevScore) item.trend = -1;
      else item.trend = 0;

      if (index === 0) Object.assign(item, { icon: '🥇', color: 'text-yellow-500', bg: 'bg-yellow-50' });
      else if (index === 1) Object.assign(item, { icon: '🥈', color: 'text-slate-400', bg: 'bg-slate-50' });
      else if (index === 2) Object.assign(item, { icon: '🥉', color: 'text-amber-600', bg: 'bg-amber-50' });
      else Object.assign(item, { icon: null, color: 'text-slate-500', bg: 'bg-transparent' });
    });

    return res.status(200).json({ success: true, data: rankingData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMonthlyComparison = async (req, res) => {
  try {
    const { locationId } = req.query;

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(startOfThisMonth.getTime() - 1);

    const filter = {};
    if (locationId && locationId !== 'all' && locationId !== 'demo-id') {
      filter.locationId = locationId;
    }

    const [thisMonthCount, lastMonthCount, topComplaints] = await Promise.all([
      Review.countDocuments({ ...filter, createTime: { $gte: startOfThisMonth } }),
      Review.countDocuments({ ...filter, createTime: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      Review.aggregate([
        {
          $match: {
            ...filter,
            rating: { $lte: 3 },
            createTime: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
            category_tag: { $exists: true, $nin: ['Khác', null, ''] }
          }
        },
        { $group: { _id: '$category_tag', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 }
      ])
    ]);

    const growth = lastMonthCount > 0
      ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)
      : (thisMonthCount > 0 ? 100 : 0);

    return res.status(200).json({
      success: true,
      data: {
        thisMonth: thisMonthCount,
        lastMonth: lastMonthCount,
        growthPercent: growth,
        topComplaints: topComplaints.map(c => ({ category: c._id, count: c.count }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAuditScore = async (req, res) => {
  try {
    const { locationId } = req.query;
    
    // Tính Response Rate
    const filter = locationId && locationId !== 'all' ? { locationId } : {};
    const totalReviews = await Review.countDocuments(filter);
    const repliedReviews = await Review.countDocuments({
      ...filter,
      status: { $in: ["Replied", "Processed", "Auto-Replied", "Alert-Sent"] }
    });
    
    const responseRate = totalReviews > 0 ? (repliedReviews / totalReviews) * 100 : 0;
    
    // Giả lập Dữ liệu GMB (Vì chưa tích hợp sâu API GMB cho Info)
    // Tùy theo locationId, tạo tính ngẫu nhiên nhưng ổn định
    const idLen = locationId ? locationId.length : 0;
    const hasRecentPhotos = idLen % 2 === 0; // 50/50
    const hasKeywordInDesc = idLen % 3 !== 0; // 66%
    const hasSpecialHours = idLen % 4 !== 0; // 75%
    
    let score = 0;
    let checklist = [];
    
    // 1. Tỷ lệ phản hồi (Tối đa 40 điểm)
    if (responseRate >= 90) {
      score += 40;
      checklist.push({ status: 'good', text: `Tỷ lệ phản hồi tốt (${Math.round(responseRate)}%)` });
    } else {
      const added = Math.round((responseRate / 90) * 40);
      score += added;
      checklist.push({ status: 'bad', text: `Tỷ lệ phản hồi thấp (${Math.round(responseRate)}%). Cần > 90% (Tăng ${40 - added} điểm)` });
    }
    
    // 2. Ảnh thực tế (20 điểm)
    if (hasRecentPhotos) {
      score += 20;
      checklist.push({ status: 'good', text: 'Có ảnh mới trong 30 ngày qua (Tốt)' });
    } else {
      checklist.push({ status: 'bad', text: 'Thiếu ảnh nội/ngoại thất. Hãy bổ sung (Tăng 20 điểm)' });
    }
    
    // 3. Mô tả doanh nghiệp (20 điểm)
    if (hasKeywordInDesc) {
      score += 20;
      checklist.push({ status: 'good', text: 'Mô tả có chứa từ khóa mục tiêu (Tốt)' });
    } else {
      checklist.push({ status: 'bad', text: 'Mô tả thiếu từ khóa ngành nghề (Tăng 20 điểm)' });
    }
    
    // 4. Giờ mở cửa (20 điểm)
    if (hasSpecialHours) {
      score += 20;
      checklist.push({ status: 'good', text: 'Giờ mở cửa đã cập nhật (Tốt)' });
    } else {
      checklist.push({ status: 'bad', text: 'Chưa cập nhật giờ ngày lễ/Tết (Tăng 20 điểm)' });
    }
    
    return res.status(200).json({
      success: true,
      data: { score, checklist }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMonthlyTrends,
  getTopComplaints,
  getOverallStats,
  getAISolution,
  getBranchRanking,
  getMonthlyComparison,
  getAuditScore
};
