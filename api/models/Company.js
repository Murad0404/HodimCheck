const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  companyCode: { type: String, required: true, unique: true },
  qrCodeData: { type: String, required: true, unique: true }, // The string to encode in QR
  faceIdEnabled: { type: Boolean, default: false },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  telegramBotToken: { type: String, default: '' },
  telegramChatId: { type: String, default: '' }, // Eski field - backward compat
  telegramSubscribers: [{
    chatId: { type: String, required: true },
    firstName: { type: String, default: '' },
    username: { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now }
  }],
  reportTimeKeldi: { type: String, default: '11:00' },
  reportTimeKetdi: { type: String, default: '19:00' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
