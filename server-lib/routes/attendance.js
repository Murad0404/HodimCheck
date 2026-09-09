const crypto = require('node:crypto');
const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { localClock } = require('../services/telegram');
const { bounds } = require('../services/dailyStats');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: 'Ruxsat yo\'q' });
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Noto\'g\'ri token' });
  }
};

// Keldi/Ketdi belgilash
router.post('/mark', authMiddleware, async (req, res) => {
  let lockOwner;
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

    const lease = crypto.randomUUID();
    const now = new Date();
    const locked = await User.findOneAndUpdate({ _id: userId, companyId, $and: [
      { $or: [{ attendanceLockUntil: { $exists: false } }, { attendanceLockUntil: { $lt: now } }] },
      { $or: [{ lastAttendanceAt: { $exists: false } }, { lastAttendanceAt: { $lt: new Date(now.getTime() - 5000) } }] }
    ] }, { $set: { attendanceLockUntil: new Date(now.getTime() + 60000), attendanceLockOwner: lease } });
    if (!locked) return res.status(409).json({ message: 'Qayd qabul qilingan yoki qayta ishlanmoqda. 5 soniyadan keyin holatni tekshiring.' });
    lockOwner = lease;
    // Bugungi kungi yozuvlar sonini hisoblash
    const { start: startOfDay, end: endOfDay } = bounds(localClock().day);

    const countToday = await Attendance.countDocuments({
      userId,
      companyId,
      timestamp: { $gte: startOfDay, $lt: endOfDay }
    });

    // Agar 0, 2, 4 bo'lsa (juft) -> 'keldi'
    // Agar 1, 3, 5 bo'lsa (toq) -> 'ketdi'
    const determinedType = (countToday % 2 === 0) ? 'keldi' : 'ketdi';

    const attendance = new Attendance({
      userId,
      companyId,
      type: determinedType,
      faceVerified: !!faceVerified
    });

    await attendance.save();
    await User.updateOne({ _id: userId, attendanceLockOwner: lease }, { $set: { lastAttendanceAt: attendance.timestamp } });

    res.status(201).json({ message: `Muvaffaqiyatli ${determinedType === 'keldi' ? 'keldingiz' : 'ketdingiz'}`, type: determinedType, count: countToday + 1, status: determinedType === 'keldi' ? 'present' : 'departed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  } finally {
    if (lockOwner) await User.updateOne({ _id: req.user.id, attendanceLockOwner: lockOwner }, { $unset: { attendanceLockUntil: 1, attendanceLockOwner: 1 } }).catch(() => {});
  }
});

router.get('/today', authMiddleware, async (req, res) => {
  try {
    const day = localClock().day;
    const { start, end } = bounds(day);
    const rows = await Attendance.find({ userId: req.user.id, companyId: req.user.companyId, timestamp: { $gte: start, $lt: end } }).sort({ timestamp: 1 }).select('timestamp');
    res.json({ day, count: rows.length, status: !rows.length ? 'absent' : rows.length % 2 ? 'present' : 'departed', firstArrival: rows[0]?.timestamp || null, lastEvent: rows.at(-1)?.timestamp || null });
  } catch { res.status(500).json({ message: 'Bugungi holatni olishda xato' }); }
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
