const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// Xodim ro'yxatdan o'tishi (Garchi hozir xodim o'zi ro'yxatdan o'tmasa ham qolib turadi)
router.post('/register', async (req, res) => {
  try {
    const { companyCode, fullName, position, password } = req.body;
    
    const company = await Company.findOne({ companyCode });
    if (!company) {
      return res.status(404).json({ message: 'Kompaniya topilmadi. Kodni tekshiring' });
    }

    const employeeId = 'EMP-' + Math.floor(1000 + Math.random() * 9000).toString();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      employeeId,
      companyId: company._id,
      fullName,
      position,
      role: 'employee',
      password: hashedPassword
    });

    await newUser.save();

    res.status(201).json({ 
      message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz', 
      employeeId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    
    const user = await User.findOne({ employeeId });
    if (!user) {
      return res.status(400).json({ message: 'Xodim topilmadi yoki parol noto\'g\'ri' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Xodim topilmadi yoki parol noto\'g\'ri' });
    }

    const token = jwt.sign({ id: user._id, role: user.role, companyId: user.companyId }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        faceDescriptor: user.faceDescriptor && user.faceDescriptor.length > 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

module.exports = router;
