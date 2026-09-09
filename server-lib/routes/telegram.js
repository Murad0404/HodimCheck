const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { connectWebhook, testDelivery } = require('../services/botConnection');
const crypto = require('node:crypto');
const { recipients, deliverToRecipients, failureMessage } = require('../services/recipients');
const { SettingsError, validateSettings, normalizeChatId } = require('../services/telegramSettings');
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
const safe = c => ({ recipients: recipients(c), webhookReady: !!c.telegramWebhookReady, webhookError: c.telegramWebhookError || '', verifiedAt: c.telegramVerifiedAt, chatTitle: c.telegramChatTitle || '', lastCronAt: c.telegramLastCronAt, lastCronResult: c.telegramLastCronResult || '', schedulerConfigured: !!c.cronApiKey, siteUrl: c.cronSiteUrl || '', schedulerStatus: c.cronSyncStatus || 'not_connected', schedulerError: c.cronSyncError || '', configured: !!c.telegramBotToken, enabled: !!c.telegramEnabled, botUsername: c.telegramBotUsername || '', chatId: c.telegramChatId || '', reportTimeKeldi: c.reportTimeKeldi, reportTimeKetdi: c.reportTimeKetdi, lastSentAt: c.telegramLastSentAt, lastError: c.telegramLastError || '' });
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
    let primary;
    try { const first = await testDelivery(c); primary = { chatId: first.chatId, title: first.chatTitle, primary: true, ok: true }; }
    catch (error) { primary = { chatId: c.telegramChatId, title: c.telegramChatTitle || 'Asosiy chat', primary: true, ok: false, error: error.message }; }
    const others = await deliverToRecipients(c, ['✅ HodimCheck sinov xabari. Bu chat hisobot oluvchilar ro‘yxatiga kiritilgan.'], { excludePrimary: true });
    const results = [primary, ...others.results];
    const failed = results.filter(r => !r.ok).length;
    c.telegramLastError = failureMessage({ results }); await c.save();
    res.json({ ...safe(c), deliveryResults: results, failed, message: `${results.length - failed} ta chatga sinov xabari yuborildi.${failed ? ` ${failed} ta chatda xato bor.` : ''}` });
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
    const chunks = statsMessages(c, await dailyStats(c._id));
    const result = await deliverToRecipients(c, chunks);
    if (result.sent) c.telegramLastSentAt = new Date();
    c.telegramLastError = failureMessage(result); await c.save();
    res.json({ ...safe(c), deliveryResults: result.results, failed: result.failed, message: `${result.sent} ta chatga bugungi hisobot yuborildi.${result.failed ? ` ${result.failed} ta chatda xato bor.` : ''}` });
  } catch (error) {
    if (c) { c.telegramLastError = error.message; await c.save().catch(() => {}); }
    res.status(400).json({ message: error.message || 'Hisobot yuborilmadi' });
  }
});
router.post('/:id/recipients', async (req, res) => {
  try {
    const chatId = normalizeChatId(req.body.chatId);
    const c = await Company.findById(req.params.id).select('+telegramBotToken');
    if (!c?.telegramBotToken) return res.status(400).json({ message: 'Avval asosiy bot sozlamalarini saqlang' });
    if ((c.telegramRecipients || []).length >= 19) return res.status(400).json({ message: 'Bir kompaniyaga jami 20 tagacha chat qo‘shish mumkin.' });
    const token = decrypt(c.telegramBotToken);
    const bot = await telegram(token, 'getMe');
    const chat = await telegram(token, 'getChat', { chat_id: chatId });
    if (String(chat.id) === String(bot.id) || (chat.username && chat.username.toLowerCase() === bot.username?.toLowerCase())) throw new SettingsError('chatId', 'Botning o‘zini emas, hisobot oladigan odam yoki guruhni qo‘shing.');
    const canonical = String(chat.id);
    if (recipients(c).some(r => r.chatId === canonical || (chat.username && r.chatId.toLowerCase() === `@${chat.username.toLowerCase()}`))) return res.status(409).json({ message: 'Bu chat allaqachon ro‘yxatda bor.' });
    const title = String(chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || canonical).slice(0, 160);
    await telegram(token, 'sendMessage', { chat_id: canonical, text: `✅ ${String(c.name).slice(0, 160)}
Bu chatga HodimCheck davomat hisobotlarini yuborish tekshirildi.` });
    const updated = await Company.findOneAndUpdate({ _id: c._id, telegramChatId: { $nin: [canonical, ...(chat.username ? [`@${chat.username}`] : [])] }, 'telegramRecipients.chatId': { $ne: canonical }, $expr: { $lt: [{ $size: { $ifNull: ['$telegramRecipients', []] } }, 19] } }, { $push: { telegramRecipients: { chatId: canonical, title } } }, { new: true });
    if (!updated) return res.status(409).json({ message: 'Ro‘yxat o‘zgardi yoki bu chat qo‘shilgan. Sahifani yangilang.' });
    res.json({ recipients: recipients(updated), message: `${title} qo‘shildi. Sinov xabari yuborildi.` });
  } catch (error) { res.status(400).json({ message: error.message || 'Chatni qo‘shib bo‘lmadi' }); }
});
router.delete('/:id/recipients/:chatId', async (req, res) => {
  try {
    const c = await Company.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Kompaniya topilmadi' });
    if (String(c.telegramChatId) === req.params.chatId) return res.status(400).json({ message: 'Asosiy chatni yuqoridagi Chat ID maydonida almashtiring.' });
    const updated = await Company.findByIdAndUpdate(c._id, { $pull: { telegramRecipients: { chatId: req.params.chatId } } }, { new: true });
    res.json({ recipients: recipients(updated), message: 'Chat olib tashlandi. Keyingi hisobotlar unga yuborilmaydi.' });
  } catch { res.status(500).json({ message: 'Chatni olib tashlab bo‘lmadi' }); }
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
