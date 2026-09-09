const crypto = require('node:crypto');
const { telegram, decrypt } = require('./telegram');
const { publicOrigin } = require('./cronScheduler');
async function connectWebhook(company) {
  const token = decrypt(company.telegramBotToken);
  company.telegramWebhookSecret ||= crypto.randomBytes(32).toString('hex');
  company.telegramWebhookReady = false;
  await company.save();
  try {
    const url = `${publicOrigin(company.cronSiteUrl)}/api/bot/${company._id}`;
    await telegram(token, 'setWebhook', { url, secret_token: company.telegramWebhookSecret, allowed_updates: ['message'] });
    await telegram(token, 'setMyCommands', { commands: [{ command: 'start', description: 'Boshlash va Chat ID olish' }, { command: 'sinov', description: 'Botni tekshirish' }, { command: 'hisobot', description: 'Bugungi davomat hisoboti' }] });
    company.telegramWebhookReady = true;
    company.telegramWebhookError = '';
    await company.save();
  } catch (error) {
    company.telegramWebhookError = error.message;
    await company.save(); throw error;
  }
}
async function testDelivery(company) {
  const token = decrypt(company.telegramBotToken);
  const bot = await telegram(token, 'getMe');
  const chat = await telegram(token, 'getChat', { chat_id: company.telegramChatId });
  if (String(chat.id) === String(bot.id) || chat.username?.toLowerCase() === bot.username?.toLowerCase()) throw new Error('Chat ID ga botning o‘zi kiritilgan. Hisobot oladigan odam yoki guruh ID sini kiriting.');
  const result = await telegram(token, 'sendMessage', { chat_id: chat.id, text: `${String(company.name).slice(0, 160)}\n✅ HodimCheck sinov xabari.\nBot shu chatga hisobot yubora oladi.\n/start — boshlash\n/sinov — tekshirish\n/hisobot — bugungi davomat` });
  company.telegramChatId = String(chat.id);
  company.telegramChatTitle = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id);
  company.telegramVerifiedAt = new Date();
  company.telegramLastError = '';
  await company.save();
  return { chatTitle: company.telegramChatTitle, chatId: company.telegramChatId, messageId: result.message_id };
}
module.exports = { connectWebhook, testDelivery };
