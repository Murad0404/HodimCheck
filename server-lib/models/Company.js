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
  telegramWebhookSecret: { type: String, default: '', select: false },
  telegramWebhookReady: { type: Boolean, default: false },
  telegramWebhookError: { type: String, default: '' },
  telegramChatTitle: { type: String, default: '' },
  telegramVerifiedAt: Date,
  telegramLastCronAt: Date,
  telegramLastCronResult: { type: String, default: '' },
  telegramBotToken: { type: String, default: '', select: false },
  cronApiKey: { type: String, default: '', select: false },
  cronCallbackSecret: { type: String, default: '', select: false },
  cronSiteUrl: { type: String, default: '' },
  cronJobKeldi: Number,
  cronJobKetdi: Number,
  cronSyncStatus: { type: String, default: 'not_connected' },
  cronSyncError: { type: String, default: '' },
  cronSyncLockUntil: Date,
  telegramEnabled: { type: Boolean, default: false },
  telegramBotUsername: { type: String, default: '' },
  telegramConfiguredAt: { type: Date },
  telegramLastSentAt: { type: Date },
  telegramLastError: { type: String, default: '' },
  telegramChatId: { type: String, default: '' }, // Eski field - backward compat
  telegramRecipients: [{ chatId: { type: String, required: true }, title: { type: String, default: '' }, addedAt: { type: Date, default: Date.now } }],
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
