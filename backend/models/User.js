const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true }, // Unik xodim raqami
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  fullName: { type: String, required: true },
  position: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
  password: { type: String, required: true },
  faceDescriptor: { type: [Number], default: [] }, // Array of numbers representing face features
  registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
