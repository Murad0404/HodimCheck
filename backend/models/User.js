const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true }, // generated like EMP-1234
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  fullName: { type: String, required: true },
  position: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
  password: { type: String, required: true },
  faceDescriptor: { type: [Number], default: [] }, // Array of numbers for face vector
  
  // Ta'til/Day Offs uchun yangi maydonlar
  totalDayOffs: { type: Number, default: 24 },
  usedDayOffs: { type: Number, default: 0 },
  dayOffDates: [{
    date: { type: String },
    reason: { type: String },
    assignedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
