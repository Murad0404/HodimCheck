const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Faqat admin uchun' });
  next();
};

// Yangi kompaniya yaratish
router.post('/', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    const companyCode = Math.floor(100000 + Math.random() * 900000).toString();
    const qrCodeData = `COMPANY_QR_${Date.now()}_${companyCode}`;

    const newCompany = new Company({
      name,
      companyCode,
      qrCodeData
    });
    
    await newCompany.save();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'admin123', salt);

    const adminUser = new User({
      employeeId: `ADMIN-${Math.floor(1000 + Math.random() * 9000)}`,
      companyId: newCompany._id,
      fullName: 'Admin',
      position: 'Admin',
      role: 'admin',
      password: hashedPassword,
      isFirstLogin: false
    });
    
    await adminUser.save();
    
    newCompany.adminId = adminUser._id;
    await newCompany.save();

    res.status(201).json({ 
      company: newCompany, 
      admin: { employeeId: adminUser.employeeId } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Kompaniya ma'lumotlarini olish
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    res.json(company);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Face ID sozlamasini o'zgartirish
router.put('/:id/faceid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { enabled } = req.body;
    const company = await Company.findByIdAndUpdate(req.params.id, { faceIdEnabled: enabled }, { new: true });
    
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    
    res.json({ message: 'Sozlamalar saqlandi', faceIdEnabled: enabled });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Ofis lokatsiyasini o'zgartirish
router.put('/:id/location', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const company = await Company.findByIdAndUpdate(
      req.params.id, 
      { location: { lat, lng } }, 
      { new: true }
    );
    
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    
    res.json({ message: 'Lokatsiya saqlandi', location: company.location });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Telegram sozlamalarini saqlash
router.put('/:id/telegram', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { telegramBotToken, telegramChatId, reportTimeKeldi, reportTimeKetdi } = req.body;
    const company = await Company.findByIdAndUpdate(
      req.params.id, 
      { telegramBotToken, telegramChatId, reportTimeKeldi, reportTimeKetdi }, 
      { new: true }
    );
    
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    
    res.json({ message: 'Telegram sozlamalari saqlandi' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Xodimlarni ro'yxatini olish
router.get('/:id/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({ companyId: req.params.id }).select('-password -faceDescriptor');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Yangi xodim qo'shish (Admin tomonidan)
router.post('/:id/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { fullName, position, totalDayOffs } = req.body;
    
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });

    const employeeId = 'EMP-' + Math.floor(1000 + Math.random() * 9000).toString();

    const newUser = new User({
      employeeId,
      companyId: req.params.id,
      fullName,
      position,
      role: 'employee',
      isFirstLogin: true,
      totalDayOffs: totalDayOffs || 24,
      usedDayOffs: 0
    });

    await newUser.save();
    res.status(201).json({ message: 'Xodim qo\'shildi', user: { employeeId, fullName, position } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Xodimga dam olish kuni (day off) qo'shish
router.post('/:id/users/:userId/dayoff', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { date, reason } = req.body;
    const user = await User.findOne({ _id: req.params.userId, companyId: req.params.id });
    
    if (!user) return res.status(404).json({ message: 'Xodim topilmadi' });
    if (user.usedDayOffs >= (user.totalDayOffs || 0)) {
      return res.status(400).json({ message: 'Xodimda dam olish kunlari qolmagan' });
    }

    user.usedDayOffs = (user.usedDayOffs || 0) + 1;
    user.dayOffDates.push({ date, reason });

    await user.save();
    res.json({ message: 'Dam olish kuni belgilandi', usedDayOffs: user.usedDayOffs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Xodimga rasm orqali yuz ma'lumotini saqlash (Admin tomonidan)
router.post('/:id/users/:userId/face', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { descriptor } = req.body;
    
    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({ message: 'Yuz ma\'lumotlari xato' });
    }

    const user = await User.findOne({ _id: req.params.userId, companyId: req.params.id });
    
    if (!user) return res.status(404).json({ message: 'Xodim topilmadi' });

    user.faceDescriptor = descriptor;
    await user.save();

    res.json({ message: 'Xodimning yuz tasdig\'i muvaffaqiyatli saqlandi' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Kompaniyaning barcha davomat tarixini olish
router.get('/:id/attendance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const attendance = await Attendance.find({ companyId: req.params.id })
      .populate('userId', 'fullName employeeId')
      .sort({ timestamp: -1 });
    
    const formatted = attendance.map(a => ({
      _id: a._id,
      timestamp: a.timestamp,
      type: a.type,
      faceVerified: a.faceVerified,
      fullName: a.userId ? a.userId.fullName : 'O\'chirilgan xodim',
      employeeId: a.userId ? a.userId.employeeId : 'N/A'
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

module.exports = router;
