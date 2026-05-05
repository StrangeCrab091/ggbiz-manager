const mongoose = require('mongoose');

const spamAlertSchema = new mongoose.Schema({
  locationId: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    required: true,
  },
  reviews: [{
    reviewId: String,
    reviewerName: String,
    rating: Number,
    reviewText: String,
    createTime: Date
  }],
  reason: {
    type: String,
    required: true,
  },
  isResolved: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('SpamAlert', spamAlertSchema);
