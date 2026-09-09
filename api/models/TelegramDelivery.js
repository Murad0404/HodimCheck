const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  status: { type: String, default: 'pending' },
  leaseUntil: Date,
  nextChunk: { type: Number, default: 0 },
  chunks: [String],
  sentAt: Date
}, { timestamps: true });
module.exports = mongoose.model('TelegramDelivery', schema);
