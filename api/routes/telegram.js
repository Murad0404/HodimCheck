const express = require('express');
const router = express.Router();
const Company = require('../models/Company');

// Telegram webhook - botga /start yuborganda shu endpoint chaqiriladi
router.post('/webhook/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const update = req.body;
    
    console.log('Telegram webhook keldi:', JSON.stringify(update).substring(0, 200));

    // Faqat xabar kelganda ishlaydi
    if (!update.message) {
      return res.json({ ok: true });
    }

    const message = update.message;
    const chat = message.chat;
    const text = message.text || '';

    // /start komandasi bo'lsa — foydalanuvchini subscriberlarga qo'shamiz
    if (text.startsWith('/start')) {
      const chatId = chat.id.toString();

      const company = await Company.findById(companyId);
      if (!company) {
        console.log('Webhook: kompaniya topilmadi:', companyId);
        return res.json({ ok: true });
      }

      // Bu chat allaqachon qo'shilganmi tekshiramiz
      const alreadyExists = company.telegramSubscribers.some(s => s.chatId === chatId);
      
      if (!alreadyExists) {
        company.telegramSubscribers.push({
          chatId: chatId,
          firstName: chat.first_name || chat.title || '',
          username: chat.username || '',
          joinedAt: new Date()
        });
        await company.save();
        console.log(`Yangi subscriber qo'shildi: ${chat.first_name || chatId} (Company: ${company.name})`);
      }

      // Xush kelibsiz xabarini yuboramiz
      if (company.telegramBotToken) {
        const fetchFn = typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(mod => mod.default(...args));
        try {
          await fetchFn(`https://api.telegram.org/bot${company.telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ <b>HodimCheck</b> tizimiga muvaffaqiyatli ulanding!\n\n🏢 Kompaniya: <b>${company.name}</b>\n\nEndi siz har kuni davomat hisobotlarini olasiz.`,
              parse_mode: 'HTML'
            })
          });
        } catch (err) {
          console.error('Xush kelibsiz xabarini yuborishda xato:', err);
        }
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook xatosi:', error);
    res.json({ ok: true }); // Telegramga doim 200 qaytaramiz
  }
});

// Subscriberlar ro'yxatini olish (admin uchun)
router.get('/subscribers/:companyId', async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    
    res.json({
      count: company.telegramSubscribers.length,
      subscribers: company.telegramSubscribers
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi' });
  }
});

module.exports = router;
