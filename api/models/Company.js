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
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', companySchema);
