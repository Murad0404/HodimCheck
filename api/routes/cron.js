const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

// fetch fallback for older Node.js versions
const fetchFn = typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(mod => mod.default(...args));

router.get('/send-reports', async (req, res) => {
  try {
    // Toshkent vaqti bilan hozirgi soatni olamiz
    const tzDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tashkent"}));
    const currentHour = tzDate.getHours().toString().padStart(2, '0');
    const timePrefix = `${currentHour}:`; // Masalan "11:" yoki "19:"

    // Shu soatda hisobot olishi kerak bo'lgan va Telegrami sozlangan kompaniyalarni topamiz
    const companies = await Company.find({
      $or: [
        { reportTimeKeldi: { $regex: `^${timePrefix}` } },
        { reportTimeKetdi: { $regex: `^${timePrefix}` } }
      ],
      telegramBotToken: { $ne: '' },
      telegramChatId: { $ne: '' }
    });

    const results = [];

    // Bugungi sana oralig'i (Toshkent vaqti bo'yicha)
    const startOfDay = new Date(tzDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(tzDate);
    endOfDay.setHours(23,59,59,999);

    for (const company of companies) {
      const isKeldiTime = company.reportTimeKeldi.startsWith(timePrefix);
      const isKetdiTime = company.reportTimeKetdi.startsWith(timePrefix);
      
      const typeStr = isKeldiTime ? 'Kelganlar' : 'Ketganlar';

      // Bugungi davomatlarni olamiz
      const attendances = await Attendance.find({
        companyId: company._id,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      }).populate('userId', 'fullName position employeeId');

      const allUsers = await User.find({ companyId: company._id, role: 'employee' });
      
      let message = `📊 <b>${company.name} - ${typeStr} hisoboti</b>\nSana: ${tzDate.toLocaleDateString('uz-UZ')}\n\n`;
      
      let presentCount = 0;
      const attendanceListText = [];
      const presentUserIds = new Set();

      const relevantLogs = attendances.filter(a => isKeldiTime ? a.type === 'keldi' : a.type === 'ketdi');
      
      for (const log of relevantLogs) {
        if (!log.userId) continue;
        const uId = log.userId._id.toString();
        if (!presentUserIds.has(uId)) {
          presentUserIds.add(uId);
          presentCount++;
          const time = new Date(log.timestamp).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute:'2-digit' });
          attendanceListText.push(`✅ ${log.userId.fullName} - ${time}`);
        }
      }

      if (attendanceListText.length > 0) {
        message += `<b>${typeStr}:</b>\n` + attendanceListText.join('\n') + `\n\n`;
      } else {
        message += `<i>Hech kim qayd etilmagan</i>\n\n`;
      }

      // Kelmaganlarni hisoblash
      if (isKeldiTime) {
        const absentees = allUsers.filter(u => !presentUserIds.has(u._id.toString()));
        message += `<b>Kelmaganlar (${absentees.length}):</b>\n`;
        if (absentees.length > 0) {
          message += absentees.map(u => `❌ ${u.fullName}`).join('\n');
        } else {
          message += `<i>Hamma kelgan</i>`;
        }
      }

      // Telegramga yuborish
      const telegramUrl = `https://api.telegram.org/bot${company.telegramBotToken}/sendMessage`;
      try {
        const tgRes = await fetchFn(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: company.telegramChatId,
            text: message,
            parse_mode: 'HTML'
          })
        });
        const tgData = await tgRes.json();
        results.push({ company: company.name, success: tgRes.ok, error: tgData.description });
      } catch (err) {
        results.push({ company: company.name, success: false, error: err.message });
      }
    }

    res.json({ message: 'Cron tugadi', processed: companies.length, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi', error: error.message });
  }
});

// Admin panelida test xabar yuborish uchun
router.post('/test-telegram', async (req, res) => {
  try {
    const { token, chatId } = req.body;
    console.log('Test telegram so\'rov keldi:', { token: token ? token.substring(0, 10) + '...' : 'YO\'Q', chatId });
    
    if (!token || !chatId) {
      return res.status(400).json({ message: 'Token yoki Chat ID yetishmayapti' });
    }
    
    const cleanToken = token.trim();
    const cleanChatId = chatId.trim();
    
    if (!cleanToken || !cleanChatId) {
      return res.status(400).json({ message: 'Token yoki Chat ID bo\'sh' });
    }
    
    const telegramUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    console.log('Telegram API ga so\'rov yuborilmoqda...');
    
    const tgRes = await fetchFn(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: '✅ <b>HodimCheck</b> tizimidan test xabar!\nSizning botingiz muvaffaqiyatli ulandi.',
        parse_mode: 'HTML'
      })
    });
    
    const tgData = await tgRes.json();
    console.log('Telegram javob:', JSON.stringify(tgData));
    
    if (tgRes.ok) {
      res.json({ message: 'Test xabar yuborildi!' });
    } else {
      const errorMsg = tgData.description || 'Telegram xatosi';
      console.error('Telegram xatosi:', errorMsg);
      res.status(400).json({ message: errorMsg, error_code: tgData.error_code });
    }
  } catch (error) {
    console.error('Test telegram xatosi:', error);
    res.status(500).json({ message: 'Server xatosi: ' + error.message });
  }
});

module.exports = router;
