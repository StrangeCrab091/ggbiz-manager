const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },
    locationId: {
      type: String,
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorPhotoUrl: {
      type: String,
    },
    text: {
      type: String,
      required: true,
    },
    upvoteCount: {
      type: Number,
      default: 0,
    },
    createTime: {
      type: Date,
      default: Date.now,
    },
    // Trả lời
    isAnswered: {
      type: Boolean,
      default: false,
    },
    answerText: {
      type: String,
    },
    answerTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['Pending', 'Answered', 'Ignored'],
      default: 'Pending',
    }
  },
  {
    timestamps: true,
  }
);

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
