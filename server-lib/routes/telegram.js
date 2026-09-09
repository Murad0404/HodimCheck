const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { SchedulerError, publicOrigin, syncSchedule } = require('../services/cronScheduler');
const Company = require('../models/Company');
const { TIME, encrypt, decrypt, telegram } = require('../services/telegram');
router.use('/:id', (req, res, next) => {
  try {
    const user = jwt.verify((req.headers.authorization || '').split(' ')[1], process.env.JWT_SECRET);
    if (user.role !== 'admin' || String(user.companyId) !== req.params.id) return res.status(403).json({ message: 'Faqat o‘z kompaniyangizni boshqarishingiz mumkin' });
    next();
  } catch { res.status(401).json({ message: 'Tizimga qayta kiring' }); }
});
const safe = c => ({ schedulerConfigured: !!c.cronApiKey, siteUrl: c.cronSiteUrl || '', schedulerStatus: c.cronSyncStatus || 'not_connected', schedulerError: c.cronSyncError || '', configured: !!c.telegramBotToken, enabled: !!c.telegramEnabled, botUsername: c.telegramBotUsername || '', chatId: c.telegramChatId || '', reportTimeKeldi: c.reportTimeKeldi, reportTimeKetdi: c.reportTimeKetdi, lastSentAt: c.telegramLastSentAt, lastError: c.telegramLastError || '' });
router.get('/:id', async (req, res) => {
  try {
    const c = await Company.findById(req.params.id).select('+telegramBotToken +cronApiKey +cronCallbackSecret');
    if (!c) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    res.json(safe(c));
  } catch { res.status(500).json({ message: 'Sozlamalarni olishda xato' }); }
});
router.put('/:id', async (req, res) => {
  let locked = false;
  try {
    const c = await Company.findById(req.params.id).select('+telegramBotToken +cronApiKey +cronCallbackSecret');
    if (!c) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    const { schedulerApiKey = '', siteUrl, token = '', chatId, reportTimeKeldi, reportTimeKetdi, enabled } = req.body;
    if (typeof token !== 'string' || typeof chatId !== 'string' || !/^(?:-?\d{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,31})$/.test(chatId.trim()) || !TIME.test(reportTimeKeldi) || !TIME.test(reportTimeKetdi) || typeof enabled !== 'boolean') return res.status(400).json({ message: 'Chat ID va vaqtlarni to‘g‘ri kiriting' });
    const raw = token.trim() || (c.telegramBotToken && decrypt(c.telegramBotToken));
    if (!raw || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(raw)) return res.status(400).json({ message: 'BotFather bergan tokenni kiriting' });
    if (typeof schedulerApiKey !== 'string' || schedulerApiKey.length > 512) throw new SchedulerError('cron-job.org API kaliti noto‘g‘ri.');
    const origin = publicOrigin(siteUrl || c.cronSiteUrl || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''));
    const schedulerKey = schedulerApiKey.trim() ? encrypt(schedulerApiKey.trim()) : c.cronApiKey;
    if (enabled && !schedulerKey) throw new SchedulerError('Avtomatik yuborish uchun cron-job.org API kalitini kiriting.');
    // Encrypt before calling Telegram so a missing server key cannot save plaintext.
    const encrypted = encrypt(raw);
    let username = c.telegramBotUsername;
    if (token.trim() || enabled) {
      const bot = await telegram(raw, 'getMe');
      await telegram(raw, 'getChat', { chat_id: chatId.trim() });
      username = bot.username;
    }
    const lease = await Company.findOneAndUpdate({ _id: c._id, updatedAt: c.updatedAt, $or: [{ cronSyncLockUntil: { $exists: false } }, { cronSyncLockUntil: { $lt: new Date() } }] }, { $set: { cronSyncLockUntil: new Date(Date.now() + 180000) } });
    if (!lease) return res.status(409).json({ message: 'Jadval saqlanmoqda. Birozdan keyin qayta urinib ko‘ring.' });
    locked = true;
    Object.assign(c, { cronApiKey: schedulerKey, cronSiteUrl: origin, cronCallbackSecret: c.cronCallbackSecret || crypto.randomBytes(32).toString('hex'), cronSyncStatus: 'syncing', cronSyncError: '', telegramBotToken: encrypted, telegramBotUsername: username, telegramChatId: chatId.trim(), reportTimeKeldi, reportTimeKetdi, telegramEnabled: false, telegramConfiguredAt: new Date(), telegramLastError: '' });
    await c.save();
    try {
      if (schedulerKey) await syncSchedule(c, enabled);
      c.telegramEnabled = enabled; c.cronSyncStatus = enabled ? 'synced' : 'paused';
      await c.save();
      res.json({ ...safe(c), message: enabled ? 'Saqlandi. Hisobotlar faqat tanlangan vaqtlarda yuboriladi.' : 'Saqlandi. Avtomatik yuborish o‘chirilgan.' });
    } catch (error) {
      c.telegramEnabled = false;
      c.cronSyncStatus = 'error'; c.cronSyncError = error instanceof SchedulerError ? error.message : 'Jadval saqlanmadi. Qayta urinib ko‘ring.';
      await c.save();
      res.status(502).json({ ...safe(c), settingsSaved: true, message: c.cronSyncError + ' Avtomatik yuborish vaqtincha o‘chirilgan.' });
    }
  } catch (error) { res.status(400).json({ message: error instanceof SchedulerError || error.message.startsWith('Serverda') || error.message.startsWith('Telegram') || error.message.startsWith('Bot') || error.message.startsWith('Chat') ? error.message : 'Sozlamalarni saqlab bo‘lmadi' }); }
  finally { if (locked) await Company.updateOne({ _id: req.params.id }, { $unset: { cronSyncLockUntil: 1 } }).catch(() => {}); }
});
router.post('/:id/test', async (req, res) => {
  try {
    const c = await Company.findById(req.params.id).select('+telegramBotToken +cronApiKey +cronCallbackSecret');
    if (!c?.telegramBotToken || !c.telegramChatId) return res.status(400).json({ message: 'Avval bot sozlamalarini saqlang' });
    await telegram(decrypt(c.telegramBotToken), 'sendMessage', { chat_id: c.telegramChatId, text: `${c.name}\nHodimCheck muvaffaqiyatli ulandi. Bu sinov xabari.` });
    res.json({ message: 'Sinov xabari yuborildi. Telegramni tekshiring.' });
  } catch { res.status(400).json({ message: 'Xabar yuborilmadi. Botga /start bosing yoki chatga yozish huquqini tekshiring.' }); }
});
module.exports = router;
