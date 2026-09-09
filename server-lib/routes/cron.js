const { deliverToRecipients, failureMessage } = require('../services/recipients');
const crypto = require('node:crypto');
const router = require('express').Router();
const Company = require('../models/Company');
const { dailyStats, statsMessages } = require('../services/dailyStats');
const Delivery = require('../models/TelegramDelivery');
const { decrypt, telegram, localClock, reportWindow, reportChunks } = require('../services/telegram');
router.get('/telegram', async (req, res) => {
  const scoped = req.query?.company;
  if (scoped && (!/^[a-f0-9]{24}$/i.test(scoped) || !['keldi', 'ketdi'].includes(req.query.type))) return res.status(400).json({ message: 'Noto‘g‘ri jadval' });
  if (!scoped && (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`)) return res.status(401).json({ message: 'Ruxsat yo‘q' });
  try {
    if (scoped) {
      const owner = await Company.findById(scoped).select('+cronCallbackSecret');
      const actual = Buffer.from(req.headers.authorization || '');
      const expected = Buffer.from(`Bearer ${owner?.cronCallbackSecret || ''}`);
      if (!owner?.cronCallbackSecret || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return res.status(401).json({ message: 'Ruxsat yo‘q' });
      await Company.updateOne({ _id: scoped }, { $set: { telegramLastCronAt: new Date(), telegramLastCronResult: owner.telegramEnabled ? 'Hisobot tekshirilmoqda' : 'Avtomatik yuborish o‘chirilgan' } });
    }
    await Delivery.init();
    const now = new Date();
    const { day, time } = localClock(now);
    const companies = await Company.find({ telegramEnabled: true, ...(scoped ? { _id: scoped } : {}) }).select('+telegramBotToken');
    let sent = 0, failed = 0;
    for (const c of companies) {
      for (const type of (scoped ? [req.query.type] : ['keldi', 'ketdi'])) {
        const due = c[type === 'keldi' ? 'reportTimeKeldi' : 'reportTimeKetdi'];
        const { start, end } = reportWindow(day, due);
        if (time < due || !c.telegramBotToken || !c.telegramChatId) {
          await Company.updateOne({ _id: c._id }, { $set: { telegramLastCronResult: time < due ? `Hisobot vaqti hali kelmagan: ${due}` : 'Bot yoki chat sozlanmagan' } });
          continue;
        }
        const key = `${c._id}:${day}:${type}`;
        try { await Delivery.updateOne({ key }, { $setOnInsert: { key, status: 'pending', nextChunk: 0 } }, { upsert: true }); }
        catch (error) { if (error.code !== 11000) throw error; }
        const job = await Delivery.findOneAndUpdate({ key, status: { $ne: 'sent' }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }] }, { $set: { leaseUntil: new Date(Date.now() + 300000) } }, { new: true });
        if (!job) { await Company.updateOne({ _id: c._id }, { $set: { telegramLastCronResult: 'Hisobot oldin yuborilgan yoki yuborilmoqda' } }); continue; }
        try {
          if (!job.chunks.length) {
            const stats = await dailyStats(c._id, day, end);
            job.chunks = statsMessages(c, stats, `${type === 'keldi' ? 'Keldi' : 'Ketdi'} hisoboti · ${due}`);
            await job.save();
          }
          const result = await deliverToRecipients(c, job.chunks, { job });
          if (result.failed) throw new Error(failureMessage(result));
          await Delivery.updateOne({ key }, { $set: { status: 'sent', sentAt: new Date() }, $unset: { leaseUntil: 1 } });
          await Company.updateOne({ _id: c._id }, { $set: { telegramLastSentAt: new Date(), telegramLastError: '', telegramLastCronResult: `${type} hisoboti yuborildi` } });
          sent++;
        } catch (error) {
          failed++;
          await Company.updateOne({ _id: c._id }, { $set: { telegramLastError: error.message || 'Hisobot yuborilmadi', telegramLastCronResult: `${type} hisobotida xato` } });
          await Delivery.updateOne({ key }, { $set: { leaseUntil: new Date(Date.now() + 60000) } });
        }
      }
    }
    res.status(failed ? 502 : 200).json({ sent, failed });
  } catch { res.status(500).json({ message: 'Hisobotlarni qayta ishlashda xato' }); }
});
module.exports = router;
