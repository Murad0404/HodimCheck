const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  type: { type: String, enum: ['keldi', 'ketdi'], required: true },
  timestamp: { type: Date, default: Date.now },
  faceVerified: { type: Boolean, default: false }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
