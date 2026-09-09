const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { connectWebhook, testDelivery } = require('../services/botConnection');
const crypto = require('node:crypto');
const { SettingsError, validateSettings } = require('../services/telegramSettings');
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
const safe = c => ({ webhookReady: !!c.telegramWebhookReady, webhookError: c.telegramWebhookError || '', verifiedAt: c.telegramVerifiedAt, chatTitle: c.telegramChatTitle || '', lastCronAt: c.telegramLastCronAt, lastCronResult: c.telegramLastCronResult || '', schedulerConfigured: !!c.cronApiKey, siteUrl: c.cronSiteUrl || '', schedulerStatus: c.cronSyncStatus || 'not_connected', schedulerError: c.cronSyncError || '', configured: !!c.telegramBotToken, enabled: !!c.telegramEnabled, botUsername: c.telegramBotUsername || '', chatId: c.telegramChatId || '', reportTimeKeldi: c.reportTimeKeldi, reportTimeKetdi: c.reportTimeKetdi, lastSentAt: c.telegramLastSentAt, lastError: c.telegramLastError || '' });
router.get('/:id', async (req, res) => {
  try {
    const c = await Company.findById(req.params.id).select('+telegramBotToken +cronApiKey +cronCallbackSecret +telegramWebhookSecret');
    if (!c) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    res.json(safe(c));
  } catch { res.status(500).json({ message: 'Sozlamalarni olishda xato' }); }
});
router.put('/:id', async (req, res) => {
  let locked = false;
  try {
    const c = await Company.findById(req.params.id).select('+telegramBotToken +cronApiKey +cronCallbackSecret +telegramWebhookSecret');
    if (!c) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    const { schedulerApiKey = '', siteUrl, token = '', enabled } = req.body;
    const { chatId, reportTimeKeldi, reportTimeKetdi } = validateSettings(req.body);
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
      const target = await telegram(raw, 'getChat', { chat_id: chatId });
      if (String(target.id) === String(bot.id) || target.username?.toLowerCase() === bot.username?.toLowerCase()) throw new SettingsError('chatId', 'Botning @nomi Chat ID emas. Hisobot oladigan odam yoki guruh ID sini kiriting.');
      username = bot.username;
    }
    const lease = await Company.findOneAndUpdate({ _id: c._id, updatedAt: c.updatedAt, $or: [{ cronSyncLockUntil: { $exists: false } }, { cronSyncLockUntil: { $lt: new Date() } }] }, { $set: { cronSyncLockUntil: new Date(Date.now() + 180000) } });
    if (!lease) return res.status(409).json({ message: 'Jadval saqlanmoqda. Birozdan keyin qayta urinib ko‘ring.' });
    locked = true;
    const destinationChanged = !!token.trim() || c.telegramChatId !== chatId;
    if (destinationChanged) { c.telegramVerifiedAt = undefined; c.telegramChatTitle = ''; }
    Object.assign(c, { cronApiKey: schedulerKey, cronSiteUrl: origin, cronCallbackSecret: c.cronCallbackSecret || crypto.randomBytes(32).toString('hex'), cronSyncStatus: 'syncing', cronSyncError: '', telegramBotToken: encrypted, telegramBotUsername: username, telegramChatId: chatId.trim(), reportTimeKeldi, reportTimeKetdi, telegramEnabled: false, telegramConfiguredAt: c.telegramConfiguredAt || new Date(), telegramLastError: '' });
    await c.save();
    try {
      await connectWebhook(c);
      if (destinationChanged || !c.telegramVerifiedAt) await testDelivery(c);
      if (schedulerKey) await syncSchedule(c, enabled);
      c.telegramEnabled = enabled; c.cronSyncStatus = enabled ? 'synced' : 'paused';
      await c.save();
      res.json({ ...safe(c), message: enabled ? 'Saqlandi. Hisobotlar faqat tanlangan vaqtlarda yuboriladi.' : 'Saqlandi. Avtomatik yuborish o‘chirilgan.' });
    } catch (error) {
      c.telegramEnabled = false;
      c.cronSyncStatus = 'error'; c.cronSyncError = error.message || 'Ulanishni yakunlab bo‘lmadi. Qayta urinib ko‘ring.';
      await c.save();
      res.status(502).json({ ...safe(c), settingsSaved: true, message: c.cronSyncError + ' Avtomatik yuborish vaqtincha o‘chirilgan.' });
    }
  } catch (error) { res.status(400).json({ ...(error instanceof SettingsError ? { field: error.field } : {}), message: error instanceof SettingsError || error instanceof SchedulerError || error.message.startsWith('Serverda') || error.message.startsWith('Telegram') || error.message.startsWith('Bot') || error.message.startsWith('Chat') ? error.message : 'Sozlamalarni saqlab bo‘lmadi' }); }
  finally { if (locked) await Company.updateOne({ _id: req.params.id }, { $unset: { cronSyncLockUntil: 1 } }).catch(() => {}); }
});
router.post('/:id/test', async (req, res) => {
  let c;
  try {
    c = await Company.findById(req.params.id).select('+telegramBotToken +telegramWebhookSecret +cronApiKey');
    if (!c?.telegramBotToken || !c.telegramChatId) return res.status(400).json({ message: 'Avval bot sozlamalarini saqlang' });
    await connectWebhook(c);
    const result = await testDelivery(c);
    res.json({ ...safe(c), message: `Sinov xabari yuborildi: ${result.chatTitle} (Chat ID: ${result.chatId}).`, messageId: result.messageId });
  } catch (error) {
    const message = error.message || 'Sinov xabari yuborilmadi';
    if (c) { c.telegramLastError = message; await c.save().catch(() => {}); }
    res.status(400).json({ message });
  }
});
router.post('/:id/report', async (req, res) => {
  let c;
  try {
    c = await Company.findById(req.params.id).select('+telegramBotToken +cronApiKey');
    if (!c?.telegramBotToken || !c.telegramChatId) return res.status(400).json({ message: 'Avval bot va chatni saqlang' });
    const { dailyStats, statsMessages } = require('../services/dailyStats');
    const token = decrypt(c.telegramBotToken);
    const chunks = statsMessages(c, await dailyStats(c._id));
    for (const text of chunks) await telegram(token, 'sendMessage', { chat_id: c.telegramChatId, text });
    c.telegramLastSentAt = new Date(); c.telegramLastError = ''; await c.save();
    res.json({ ...safe(c), message: 'Bugungi statistika Telegramga yuborildi.' });
  } catch (error) {
    if (c) { c.telegramLastError = error.message; await c.save().catch(() => {}); }
    res.status(400).json({ message: error.message || 'Hisobot yuborilmadi' });
  }
});
router.get('/:id/diagnostics', async (req, res) => {
  try {
    const c = await Company.findById(req.params.id).select('+telegramBotToken +cronApiKey');
    if (!c?.telegramBotToken) return res.status(400).json({ message: 'Avval botni saqlang' });
    const info = await telegram(decrypt(c.telegramBotToken), 'getWebhookInfo');
    const correctUrl = `${publicOrigin(c.cronSiteUrl)}/api/bot/${c._id}`;
    const scheduler = c.cronApiKey ? await require('../services/cronScheduler').scheduleStatus(c) : [];
    res.json({ ...safe(c), webhookMatches: info.url === correctUrl, webhookPending: info.pending_update_count, webhookLastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000) : null, webhookDeliveryError: info.last_error_message ? 'Telegram webhook manziliga yetib bora olmayapti. Vercel deployi va Deployment Protection sozlamasini tekshiring.' : '', scheduler });
  } catch (error) { res.status(400).json({ message: error.message || 'Tekshirishda xato' }); }
});
module.exports = router;
