const express = require('express');
const router = express.Router();
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');

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

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Faqat admin uchun' });
  next();
};

// Xodim o'zi uchun so'rov yuborishi
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { date, reason } = req.body;
    
    // Check if employee has available day offs
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Xodim topilmadi' });
    
    if (user.usedDayOffs >= (user.totalDayOffs || 24)) {
      return res.status(400).json({ message: 'Sizda qolgan dam olish kunlari yo\'q' });
    }

    // Check if request already exists for this date
    const existing = await LeaveRequest.findOne({ userId: user._id, date });
    if (existing) {
      return res.status(400).json({ message: 'Bu sana uchun so\'rov yuborilgan' });
    }

    const leaveRequest = new LeaveRequest({
      userId: req.user.id,
      companyId: req.user.companyId,
      date,
      reason
    });

    await leaveRequest.save();
    res.status(201).json({ message: 'So\'rov muvaffaqiyatli yuborildi', leaveRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Xodim o'zining so'rovlarini ko'rishi
router.get('/my-requests', authMiddleware, async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Admin kompaniyadagi barcha so'rovlarni ko'rishi
router.get('/company', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ companyId: req.user.companyId })
      .populate('userId', 'fullName employeeId position')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Admin so'rovni tasdiqlashi yoki rad etishi
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' yoki 'rejected'
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    
    if (!leaveRequest) return res.status(404).json({ message: 'So\'rov topilmadi' });
    if (leaveRequest.companyId.toString() !== req.user.companyId) {
      return res.status(403).json({ message: 'Sizga ruxsat yo\'q' });
    }

    // Agar endi tasdiqlanayotgan bo'lsa
    if (status === 'approved' && leaveRequest.status !== 'approved') {
      const user = await User.findById(leaveRequest.userId);
      if (user) {
        if (user.usedDayOffs >= (user.totalDayOffs || 24)) {
          return res.status(400).json({ message: 'Xodimda qolgan dam olish kunlari yo\'q' });
        }
        user.usedDayOffs = (user.usedDayOffs || 0) + 1;
        
        // Also add to dayOffDates to keep existing logic intact
        if (!user.dayOffDates) user.dayOffDates = [];
        user.dayOffDates.push({ date: leaveRequest.date, reason: leaveRequest.reason });
        
        await user.save();
      }
    } 
    // Agar oldin tasdiqlangan bo'lib, endi rad etilayotgan bo'lsa (kunni qaytarish)
    else if (status === 'rejected' && leaveRequest.status === 'approved') {
      const user = await User.findById(leaveRequest.userId);
      if (user) {
        user.usedDayOffs = Math.max(0, (user.usedDayOffs || 0) - 1);
        user.dayOffDates = user.dayOffDates.filter(d => d.date !== leaveRequest.date);
        await user.save();
      }
    }

    leaveRequest.status = status;
    await leaveRequest.save();

    res.json({ message: `So'rov ${status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`, leaveRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

module.exports = router;
