const { decrypt, telegram } = require('./telegram');
function recipients(company) {
  const list = company.telegramChatId ? [{ chatId: String(company.telegramChatId), title: company.telegramChatTitle || 'Asosiy chat', primary: true }] : [];
  for (const r of company.telegramRecipients || []) {
    if (r.chatId && !list.some(x => x.chatId.toLowerCase() === String(r.chatId).toLowerCase())) list.push({ chatId: String(r.chatId), title: r.title || String(r.chatId), primary: false });
  }
  return list;
}
function authorizedRecipient(company, chat) {
  return recipients(company).some(r => r.chatId === String(chat.id) || (!!chat.username && r.chatId.toLowerCase() === `@${chat.username.toLowerCase()}`));
}
async function deliverToRecipients(company, chunks, options = {}) {
  const token = decrypt(company.telegramBotToken);
  const list = recipients(company).filter(r => !options.excludePrimary || !r.primary);
  const results = [];
  const job = options.job;
  if (job) {
    job.recipientProgress ||= [];
    // Migrate partial pre-multi-chat deliveries without repeating the primary chat's completed chunks.
    if (!job.recipientProgress.length && job.nextChunk > 0 && company.telegramChatId) job.recipientProgress.push({ chatId: String(company.telegramChatId), nextChunk: job.nextChunk });
  }
  for (const r of list) {
    let progress;
    if (job) {
      progress = job.recipientProgress.find(p => p.chatId === r.chatId);
      if (!progress) { job.recipientProgress.push({ chatId: r.chatId, nextChunk: 0 }); progress = job.recipientProgress.at(-1); }
    }
    try {
      for (let i = progress?.nextChunk || 0; i < chunks.length; i++) {
        if (job) { job.leaseUntil = new Date(Date.now() + 300000); await job.save(); }
        await telegram(token, 'sendMessage', { chat_id: r.chatId, text: chunks[i] });
        if (progress) { progress.nextChunk = i + 1; await job.save(); }
      }
      results.push({ ...r, ok: true });
    } catch (error) { results.push({ ...r, ok: false, error: error.message || 'Xabar yuborilmadi' }); }
  }
  return { results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length };
}
function failureMessage(result) { return result.results.filter(r => !r.ok).map(r => `${r.title} (${r.chatId}): ${r.error}`).join('; ').slice(0, 2000); }
module.exports = { recipients, authorizedRecipient, deliverToRecipients, failureMessage };
