const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Faqat admin uchun' });
  next();
};

// Yangi kompaniya yaratish
router.post('/', async (req, res) => {
  try {
    const { name, password } = req.body;
    const db = readDb();
    
    const companyCode = Math.floor(100000 + Math.random() * 900000).toString();
    const qrCodeData = `COMPANY_QR_${Date.now()}_${companyCode}`;

    const newCompany = {
      _id: generateId(),
      name,
      companyCode,
      qrCodeData,
      faceIdEnabled: false,
      createdAt: new Date().toISOString()
    };
    
    db.companies.push(newCompany);

    // Create default admin for this company
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'admin123', salt);

    const adminUser = {
      _id: generateId(),
      employeeId: `ADMIN-${Math.floor(1000 + Math.random() * 9000)}`,
      companyId: newCompany._id,
      fullName: 'Admin',
      position: 'Admin',
      role: 'admin',
      password: hashedPassword,
      faceDescriptor: []
    };
    
    db.users.push(adminUser);
    newCompany.adminId = adminUser._id;
    
    writeDb(db);

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
    const db = readDb();
    const company = db.companies.find(c => c._id === req.params.id);
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
    const db = readDb();
    const companyIndex = db.companies.findIndex(c => c._id === req.params.id);
    
    if (companyIndex === -1) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    
    db.companies[companyIndex].faceIdEnabled = enabled;
    writeDb(db);
    
    res.json({ message: 'Sozlamalar saqlandi', faceIdEnabled: enabled });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Xodimlarni ro'yxatini olish
router.get('/:id/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = readDb();
    const users = db.users.filter(u => u.companyId === req.params.id);
    // Don't send password hashes
    const safeUsers = users.map(u => {
      const { password, faceDescriptor, ...safeData } = u;
      return safeData;
    });
    res.json(safeUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Yangi xodim qo'shish (Admin tomonidan)
router.post('/:id/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { fullName, position, totalDayOffs } = req.body;
    const db = readDb();
    
    const company = db.companies.find(c => c._id === req.params.id);
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });

    const employeeId = 'EMP-' + Math.floor(1000 + Math.random() * 9000).toString();
    const salt = await bcrypt.genSalt(10);
    // Standart parol (masalan, 123456) bilan qo'shish
    const hashedPassword = await bcrypt.hash('123456', salt);

    const newUser = {
      _id: generateId(),
      employeeId,
      companyId: req.params.id,
      fullName,
      position,
      role: 'employee',
      password: hashedPassword,
      faceDescriptor: [],
      totalDayOffs: totalDayOffs || 0,
      usedDayOffs: 0,
      dayOffDates: []
    };

    db.users.push(newUser);
    writeDb(db);

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
    const db = readDb();
    const userIndex = db.users.findIndex(u => u._id === req.params.userId && u.companyId === req.params.id);
    
    if (userIndex === -1) return res.status(404).json({ message: 'Xodim topilmadi' });

    const user = db.users[userIndex];
    if (user.usedDayOffs >= (user.totalDayOffs || 0)) {
      return res.status(400).json({ message: 'Xodimda dam olish kunlari qolmagan' });
    }

    user.usedDayOffs = (user.usedDayOffs || 0) + 1;
    if (!user.dayOffDates) user.dayOffDates = [];
    user.dayOffDates.push({ date, reason, assignedAt: new Date().toISOString() });

    writeDb(db);
    res.json({ message: 'Dam olish kuni belgilandi', usedDayOffs: user.usedDayOffs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Kompaniyaning barcha davomat tarixini olish
router.get('/:id/attendance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = readDb();
    const attendance = db.attendance.filter(a => a.companyId === req.params.id);
    
    // Foydalanuvchi ismlarini biriktirish
    const enhancedAttendance = attendance.map(a => {
      const user = db.users.find(u => u._id === a.userId);
      return {
        ...a,
        fullName: user ? user.fullName : 'Noma\'lum xodim',
        employeeId: user ? user.employeeId : 'N/A'
      };
    });

    enhancedAttendance.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(enhancedAttendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

module.exports = router;
