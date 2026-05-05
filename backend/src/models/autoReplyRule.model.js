const mongoose = require('mongoose');

const autoReplyRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    minStars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 1,
    },
    maxStars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 5,
    },
    conditionHasText: {
      type: String,
      enum: ['both', 'has_text', 'no_text'],
      default: 'both',
    },
    delayMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    aiPrompt: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const AutoReplyRule = mongoose.model('AutoReplyRule', autoReplyRuleSchema);

module.exports = AutoReplyRule;
