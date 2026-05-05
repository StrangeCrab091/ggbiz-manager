const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    locationId: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },
    title: {
      type: String,
      default: 'Chưa có tên',
    },
  },
  {
    timestamps: true,
  }
);

const Location = mongoose.model('Location', locationSchema);

module.exports = Location;
