const express = require('express');
const router = express.Router();
const { readDb, writeDb, generateId } = require('../db');

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

    const db = readDb();
    const company = db.companies.find(c => c._id === companyId);
    
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });

    if (company.qrCodeData !== qrData) {
      return res.status(400).json({ message: 'Noto\'g\'ri QR kod skaner qilindi' });
    }

    if (company.faceIdEnabled && !faceVerified) {
      return res.status(400).json({ message: 'Yuzni tasdiqlash majburiy' });
    }

    const attendance = {
      _id: generateId(),
      userId,
      companyId,
      type,
      faceVerified: !!faceVerified,
      timestamp: new Date().toISOString()
    };

    db.attendance.push(attendance);
    writeDb(db);

    res.status(201).json({ message: `Muvaffaqiyatli ${type === 'keldi' ? 'keldingiz' : 'ketdingiz'}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Xodimning davomat tarixini olish
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const db = readDb();
    const history = db.attendance
      .filter(a => a.userId === req.user.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 30);
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

    const db = readDb();
    const userIndex = db.users.findIndex(u => u._id === req.user.id);
    if (userIndex === -1) return res.status(404).json({ message: 'Xodim topilmadi' });

    db.users[userIndex].faceDescriptor = descriptor;
    writeDb(db);

    res.json({ message: 'Yuzingiz muvaffaqiyatli ro\'yxatdan o\'tkazildi' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Userning yuz ma'lumotini olish (taqqoslash uchun)
router.get('/face-data', authMiddleware, async (req, res) => {
  try {
    const db = readDb();
    const user = db.users.find(u => u._id === req.user.id);
    
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
