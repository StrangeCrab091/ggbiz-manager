const mongoose = require('mongoose');

const authSchema = new mongoose.Schema(
  {
    accountId: {
      type: String,
      default: 'system',
      unique: true,
    },
    tokens: {
      type: Object,
      required: true,
    },
    googleAccountId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Auth = mongoose.model('Auth', authSchema);

module.exports = Auth;
