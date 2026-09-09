const router = require('express').Router();
const crypto = require('node:crypto');
const Company = require('../models/Company');
const Delivery = require('../models/TelegramDelivery');
const { decrypt, telegram, localClock } = require('../services/telegram');
const { dailyStats, statsMessages } = require('../services/dailyStats');
const { authorizedRecipient: authorizedChat } = require('../services/recipients');
function command(text, username) {
  const input = text.trim().toLowerCase();
  const first = input.split(/\s/)[0];
  const [name, target] = first.split('@');
  if (target && target !== username?.toLowerCase()) return '';
  if (name === '/start') return 'start';
  if (name === '/sinov' || input === 'sinov' || input === '✅ sinov') return 'sinov';
  if (name === '/hisobot' || input === 'hisobot' || input === '📊 bugungi hisobot') return 'hisobot';
  return '';
}
router.post('/:id', async (req, res) => {
  let key;
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.sendStatus(404);
    const company = await Company.findById(req.params.id).select('+telegramBotToken +telegramWebhookSecret');
    const received = Buffer.from(req.headers['x-telegram-bot-api-secret-token'] || '');
    const expected = Buffer.from(company?.telegramWebhookSecret || '');
    if (!expected.length || received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return res.sendStatus(401);
    const message = req.body.message;
    if (!Number.isSafeInteger(req.body.update_id) || !message?.chat?.id || typeof message.text !== 'string' || message.from?.is_bot) return res.sendStatus(200);
    const action = command(message.text, company.telegramBotUsername);
    if (!action) return res.sendStatus(200);
    const token = decrypt(company.telegramBotToken);
    key = `bot:${company._id}:${token.split(':')[0]}:${req.body.update_id}`;
    await Delivery.init();
    try { await Delivery.updateOne({ key }, { $setOnInsert: { key, status: 'pending', nextChunk: 0 } }, { upsert: true }); } catch (e) { if (e.code !== 11000) throw e; }
    const job = await Delivery.findOneAndUpdate({ key, status: { $ne: 'sent' }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: new Date() } }] }, { $set: { leaseUntil: new Date(Date.now() + 300000) } }, { new: true });
    if (!job) { const previous = await Delivery.findOne({ key }).select('status'); return res.sendStatus(previous?.status === 'sent' ? 200 : 503); }
    if (!job.chunks.length) {
      if (action === 'hisobot') job.chunks = authorizedChat(company, message.chat) ? statsMessages(company, await dailyStats(company._id, localClock().day)) : ['Bu chatga hisobot olish huquqi berilmagan. Administrator ushbu chatni qabul qiluvchilar ro‘yxatiga qo‘shishi kerak.'];
      else if (action === 'start') job.chunks = [`Xush kelibsiz! 👋\nHodimCheck botiga ulandingiz.\n\nUshbu chat ID: ${message.chat.id}\n\n/sinov — botni tekshirish\n/hisobot — bugungi davomat\n\nHisobot shu chatga kelishi uchun ID ni admin panelga kiriting.`];
      else job.chunks = [`✅ Bot ishlayapti.\nChat ID: ${message.chat.id}`];
      await job.save();
    }
    for (let i = job.nextChunk; i < job.chunks.length; i++) {
      await telegram(token, 'sendMessage', { chat_id: message.chat.id, text: job.chunks[i], ...(message.chat.type === 'private' ? { reply_markup: { keyboard: [[{ text: '📊 Bugungi hisobot' }, { text: '✅ Sinov' }]], resize_keyboard: true } } : {}) });
      await Delivery.updateOne({ key }, { $set: { nextChunk: i + 1, leaseUntil: new Date(Date.now() + 300000) } });
    }
    await Delivery.updateOne({ key }, { $set: { status: 'sent', sentAt: new Date() }, $unset: { leaseUntil: 1 } });
    res.sendStatus(200);
  } catch {
    if (key) await Delivery.updateOne({ key }, { $unset: { leaseUntil: 1 } }).catch(() => {});
    res.sendStatus(502);
  }
});
module.exports = router;
module.exports.authorizedChat = authorizedChat;
module.exports.command = command;
