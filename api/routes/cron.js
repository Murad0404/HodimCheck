const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

// fetch fallback for older Node.js versions
const fetchFn = typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(mod => mod.default(...args));

// Barcha subscriberlarga xabar yuborish funksiyasi
async function broadcastMessage(botToken, subscribers, message) {
  const results = [];
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  for (const sub of subscribers) {
    try {
      const tgRes = await fetchFn(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: sub.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      const tgData = await tgRes.json();
      results.push({ chatId: sub.chatId, name: sub.firstName, success: tgRes.ok, error: tgData.description });
    } catch (err) {
      results.push({ chatId: sub.chatId, name: sub.firstName, success: false, error: err.message });
    }
  }
  return results;
}

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
      'telegramSubscribers.0': { $exists: true } // Kamida 1 ta subscriber bo'lishi kerak
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

      // Barcha subscriberlarga broadcast qilish
      const broadcastResults = await broadcastMessage(company.telegramBotToken, company.telegramSubscribers, message);
      results.push({ 
        company: company.name, 
        subscriberCount: company.telegramSubscribers.length,
        sent: broadcastResults.filter(r => r.success).length,
        failed: broadcastResults.filter(r => !r.success).length,
        details: broadcastResults
      });
    }

    res.json({ message: 'Cron tugadi', processed: companies.length, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server xatosi', error: error.message });
  }
});

// Admin panelida test xabar yuborish uchun (barcha subscriberlarga)
router.post('/test-telegram', async (req, res) => {
  try {
    const { token, companyId } = req.body;
    console.log('Test telegram so\'rov keldi:', { token: token ? token.substring(0, 10) + '...' : 'YO\'Q', companyId });
    
    if (!token || !companyId) {
      return res.status(400).json({ message: 'Token yoki kompaniya ID yetishmayapti' });
    }
    
    const cleanToken = token.trim();
    
    // Kompaniyaning subscriberlarini olamiz
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Kompaniya topilmadi' });
    }
    
    if (!company.telegramSubscribers || company.telegramSubscribers.length === 0) {
      return res.status(400).json({ 
        message: 'Hali hech kim botga /start bosmagan. Avval Telegramda botni oching va /start bosing!' 
      });
    }
    
    const message = `✅ <b>HodimCheck</b> tizimidan test xabar!\n\n🏢 Kompaniya: <b>${company.name}</b>\n👥 Obunachi: <b>${company.telegramSubscribers.length}</b> ta\n\nBotingiz muvaffaqiyatli ishlayapti!`;
    
    const broadcastResults = await broadcastMessage(cleanToken, company.telegramSubscribers, message);
    
    const successCount = broadcastResults.filter(r => r.success).length;
    const failCount = broadcastResults.filter(r => !r.success).length;
    
    if (successCount > 0) {
      res.json({ 
        message: `✅ ${successCount} ta obunachiga test xabar yuborildi!${failCount > 0 ? ` (${failCount} ta muvaffaqiyatsiz)` : ''}`,
        results: broadcastResults
      });
    } else {
      const firstError = broadcastResults[0]?.error || 'Noma\'lum xato';
      res.status(400).json({ message: 'Xabar yuborilmadi: ' + firstError, results: broadcastResults });
    }
  } catch (error) {
    console.error('Test telegram xatosi:', error);
    res.status(500).json({ message: 'Server xatosi: ' + error.message });
  }
});

module.exports = router;
