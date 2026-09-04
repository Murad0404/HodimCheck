const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: 'Ruxsat yo\'q' });
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET || 'supersecretkey123');
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Noto\'g\'ri token' });
  }
};

// Keldi/Ketdi belgilash
router.post('/mark', authMiddleware, async (req, res) => {
  try {
    const { qrData, type, faceVerified } = req.body;
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const company = await Company.findById(companyId);
    
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });

    if (company.qrCodeData !== qrData) {
      return res.status(400).json({ message: 'Noto\'g\'ri QR kod skaner qilindi' });
    }

    if (company.faceIdEnabled && !faceVerified) {
      return res.status(400).json({ message: 'Yuzni tasdiqlash majburiy' });
    }

    const attendance = new Attendance({
      userId,
      companyId,
      type,
      faceVerified: !!faceVerified
    });

    await attendance.save();

    res.status(201).json({ message: `Muvaffaqiyatli ${type === 'keldi' ? 'keldingiz' : 'ketdingiz'}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Xodimning davomat tarixini olish
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const history = await Attendance.find({ userId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(30);
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Yuz vektorlarini saqlash
router.post('/face-register', authMiddleware, async (req, res) => {
  try {
    const { descriptor } = req.body;
    
    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({ message: 'Yuz ma\'lumotlari xato' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Xodim topilmadi' });

    user.faceDescriptor = descriptor;
    await user.save();

    res.json({ message: 'Yuzingiz muvaffaqiyatli ro\'yxatdan o\'tkazildi' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Userning yuz ma'lumotini olish (taqqoslash uchun)
router.get('/face-data', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.faceDescriptor || user.faceDescriptor.length === 0) {
      return res.status(404).json({ message: 'Yuz ma\'lumoti topilmadi' });
    }
    res.json({ descriptor: user.faceDescriptor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

module.exports = router;
