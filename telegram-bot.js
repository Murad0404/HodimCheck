/**
 * LOCAL TELEGRAM BOT & CRON SCRIPT (Stand-alone)
 * 
 * Ushbu skript xuddi "resume" loyihangizdagi "telegram-bot-local.js" kabi 
 * to'g'ridan-to'g'ri orqa fonda ishlab turadi.
 * 
 * Ishlatish uchun terminalda yozing:
 * node telegram-bot.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Modullarni chaqiramiz
const Company = require('./api/models/Company');
const User = require('./api/models/User');
const Attendance = require('./api/models/Attendance');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Xatolik: .env faylida MONGODB_URI topilmadi.");
  process.exit(1);
}

// Baza bilan ulanish
mongoose.connect(MONGODB_URI).then(() => {
  console.log("✅ MongoDB muvaffaqiyatli ulandi!");
  startBot();
  startCron();
}).catch(err => {
  console.error("❌ MongoDB ulanish xatosi:", err);
});

// Fetch (Node.js 18 dan past versiyalar uchun himoya)
const fetchFn = typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(mod => mod.default(...args));

// Xotira
const lastUpdateIds = {};
const lastSentReports = {};

// ==========================================
// 1. TELEGRAM POLLING QISMI (Xabarlarni o'qish)
// ==========================================
async function startBot() {
  console.log("🚀 Telegram Bot ishga tushmoqda... (Polling)");
  checkUpdates();
}

async function checkUpdates() {
  try {
    // Admin paneldan kiritilgan (telegramBotToken'i bor) barcha kompaniyalarni olish
    const companies = await Company.find({ telegramBotToken: { $ne: '' } });
    
    for (const company of companies) {
      const token = company.telegramBotToken;
      const offset = (lastUpdateIds[token] || 0) + 1;
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=10`;
      
      const response = await fetchFn(url);
      const data = await response.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateIds[token] = update.update_id;
          if (update.message) {
            await handleMessage(update.message, company);
          }
        }
      }
    }
  } catch (err) {
    // Kichik tarmoq xatolariga e'tibor bermaymiz
  }
  
  // Har 2 soniyada tekshirish (resume loyihasidagi kabi)
  setTimeout(checkUpdates, 2000);
}

async function handleMessage(message, company) {
  const text = (message.text || '').trim().toLowerCase();
  const chatId = message.chat.id.toString();
  const token = company.telegramBotToken;

  if (text.startsWith('/start')) {
    // Avval qo'shilganligini tekshiramiz
    const alreadyExists = company.telegramSubscribers.some(s => s.chatId === chatId);
    let changed = false;

    if (!alreadyExists) {
      company.telegramSubscribers.push({
        chatId: chatId,
        firstName: message.chat.first_name || message.chat.title || '',
        username: message.chat.username || '',
        joinedAt: new Date()
      });
      changed = true;
    }

    // Agar company.telegramChatId bo'sh bo'lsa, avtomatik to'ldirib qo'yamiz
    if (!company.telegramChatId) {
      company.telegramChatId = chatId;
      changed = true;
    }

    if (changed) {
      await company.save();
    }

    console.log(`[Bot] Yangi /start: ${message.chat.first_name || chatId} (Kompaniya: ${company.name})`);

    const welcomeMsg = `👋 <b>Assalomu alaykum, ${message.chat.first_name || 'Admin'}!</b>\n\n` +
      `🏢 Kompaniya: <b>${company.name}</b>\n` +
      `🆔 Sizning Chat ID: <code>${chatId}</code>\n\n` +
      `✅ Siz <b>HodimCheck</b> tizimi hisobotlariga muvaffaqiyatli ulandingiz!\n` +
      `⏰ Belgilangan vaqtlarda (Keldi: ${company.reportTimeKeldi || '11:00'}, Ketdi: ${company.reportTimeKetdi || '19:00'}) avtomatik hisobotlar shu yerga keladi.\n\n` +
      `📌 <b>Mavjud buyruqlar:</b>\n` +
      `• /stats yoki /hisobot — Bugungi hozirgi davomatni ko'rish\n` +
      `• /id — O'z Telegram Chat ID ingizni bilish`;

    await sendMessage(token, chatId, welcomeMsg);
  } else if (text === '/id' || text === 'id') {
    await sendMessage(token, chatId, `🆔 Sizning Telegram Chat ID: <code>${chatId}</code>\n\nUshbu ID ni saytdagi Admin panelda "Telegram Chat ID" maydoniga kiritishingiz mumkin.`);
  } else if (text === '/stats' || text === '/hisobot' || text === 'hisobot' || text === 'statistika') {
    console.log(`[Bot] ${company.name} uchun tezkor hisobot so'raldi (/stats)...`);
    await sendInstantReport(token, chatId, company);
  } else {
    await sendMessage(token, chatId, `❓ Noma'lum buyruq.\n\nDavomat hisobotini ko'rish uchun /stats yoki /hisobot deb yozing.`);
  }
}

// Tezkor hisobot (/stats) yuborish
async function sendInstantReport(token, chatId, company) {
  try {
    const tzDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tashkent"}));
    const startOfDay = new Date(tzDate); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(tzDate); endOfDay.setHours(23,59,59,999);

    const attendances = await Attendance.find({ 
      companyId: company._id, 
      timestamp: { $gte: startOfDay, $lte: endOfDay } 
    }).populate('userId');
    
    const allUsers = await User.find({ companyId: company._id, role: 'employee' });

    let message = `📊 <b>${company.name} - Bugungi Davomat Hisoboti</b>\n`;
    message += `📅 Sana: ${tzDate.toLocaleDateString('uz-UZ')}\n`;
    message += `⏰ Vaqt: ${tzDate.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n\n`;

    const presentKeldi = [];
    const presentUserIds = new Set();

    for (const log of attendances) {
      if (!log.userId) continue;
      const uId = log.userId._id.toString();
      if (log.type === 'keldi' && !presentUserIds.has(uId)) {
        presentUserIds.add(uId);
        const time = new Date(log.timestamp).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute:'2-digit' });
        presentKeldi.push(`✅ ${log.userId.fullName} — ${time}`);
      }
    }

    message += `<b>Kelganlar (${presentKeldi.length}):</b>\n`;
    if (presentKeldi.length > 0) {
      message += presentKeldi.join('\n') + '\n\n';
    } else {
      message += `<i>Hali hech kim kelmadi</i>\n\n`;
    }

    const absentees = allUsers.filter(u => !presentUserIds.has(u._id.toString()));
    message += `<b>Kelmadi / Kutilmoqda (${absentees.length}):</b>\n`;
    if (absentees.length > 0) {
      message += absentees.map(u => `❌ ${u.fullName}`).join('\n') + '\n\n';
    } else {
      message += `<i>Barcha xodimlar kelgan! 👏</i>\n\n`;
    }

    await sendMessage(token, chatId, message);
  } catch (err) {
    console.error('Stats yuborishda xato:', err);
    await sendMessage(token, chatId, `❌ Hisobotni yuklashda xatolik yuz berdi: ${err.message}`);
  }
}

async function sendMessage(token, chatId, htmlText) {
  try {
    await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: htmlText, parse_mode: 'HTML' })
    });
  } catch (err) {
    console.error(`[Xabar yuborish xatosi - Chat: ${chatId}]:`, err.message);
  }
}

// ==========================================
// 2. AVTOMATIK HISOBOT QISMI (Cron)
// ==========================================
async function startCron() {
  console.log("🚀 Avtomatik hisobot tizimi (Cron) ishga tushdi...");
  checkCron();
}

async function checkCron() {
  try {
    const tzDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tashkent"}));
    const currentHour = tzDate.getHours().toString().padStart(2, '0');
    const currentMinute = tzDate.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    const todayStr = tzDate.toLocaleDateString('en-US');

    // Faqat tokeni bor kompaniyalarni olish
    const companies = await Company.find({ 
      telegramBotToken: { $ne: '' }
    });
    
    const startOfDay = new Date(tzDate); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(tzDate); endOfDay.setHours(23,59,59,999);

    for (const company of companies) {
      // Qabul qiluvchi Chat ID larni yig'amiz
      const targetChatIds = new Set();
      if (company.telegramChatId) {
        company.telegramChatId.toString().split(/[,;\s]+/).filter(Boolean).forEach(id => targetChatIds.add(id.trim()));
      }
      if (company.telegramSubscribers && company.telegramSubscribers.length > 0) {
        company.telegramSubscribers.forEach(sub => {
          if (sub.chatId) targetChatIds.add(sub.chatId.trim());
        });
      }
      if (targetChatIds.size === 0) continue;

      // Vaqt to'g'ri kelishini tekshirish (Admin paneldan belgilangan vaqt)
      const isKeldiTime = company.reportTimeKeldi === currentTime;
      const isKetdiTime = company.reportTimeKetdi === currentTime;
      
      if (!isKeldiTime && !isKetdiTime) continue;
      
      const typeStr = isKeldiTime ? 'Kelganlar' : 'Ketganlar';
      const reportKey = `${company._id}_${todayStr}_${typeStr}`;
      
      // Duplikatni oldini olish (bugun yuborilgan bo'lsa qayta yubormaydi)
      if (lastSentReports[reportKey]) continue;
      lastSentReports[reportKey] = true;

      console.log(`[Cron ${currentTime}] ${company.name} uchun ${typeStr} hisoboti yuborilmoqda (${targetChatIds.size} ta manzilga)...`);

      const attendances = await Attendance.find({ 
        companyId: company._id, 
        timestamp: { $gte: startOfDay, $lte: endOfDay } 
      }).populate('userId');
      
      const allUsers = await User.find({ companyId: company._id, role: 'employee' });

      let message = `📊 <b>${company.name} - ${typeStr} hisoboti</b>\nSana: ${tzDate.toLocaleDateString('uz-UZ')}\n\n`;
      
      const attendanceListText = [];
      const presentUserIds = new Set();
      const relevantLogs = attendances.filter(a => isKeldiTime ? a.type === 'keldi' : a.type === 'ketdi');
      
      for (const log of relevantLogs) {
        if (!log.userId) continue;
        const uId = log.userId._id.toString();
        if (!presentUserIds.has(uId)) {
          presentUserIds.add(uId);
          const time = new Date(log.timestamp).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute:'2-digit' });
          attendanceListText.push(`✅ ${log.userId.fullName} - ${time}`);
        }
      }

      if (attendanceListText.length > 0) {
        message += `<b>${typeStr}:</b>\n` + attendanceListText.join('\n') + `\n\n`;
      } else {
        message += `<i>Hech kim qayd etilmagan</i>\n\n`;
      }

      if (isKeldiTime) {
        const absentees = allUsers.filter(u => !presentUserIds.has(u._id.toString()));
        message += `<b>Kelmaganlar (${absentees.length}):</b>\n`;
        if (absentees.length > 0) {
          message += absentees.map(u => `❌ ${u.fullName}`).join('\n');
        } else {
          message += `<i>Hamma kelgan 👏</i>`;
        }
      }

      // Xabarni barcha manzillarga jo'natish
      for (const tChatId of targetChatIds) {
        await sendMessage(company.telegramBotToken, tChatId, message);
      }
    }
  } catch (err) {
    console.error('Cron xatosi:', err);
  }

  // Har 30 soniyada tekshiradi
  setTimeout(checkCron, 30000); 
}
