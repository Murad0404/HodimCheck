class SettingsError extends Error {
  constructor(field, message) { super(message); this.field = field; }
}
function clean(value) { return value.trim().replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, ''); }
function normalizeChatId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) value = String(value);
  if (typeof value !== 'string') throw new SettingsError('chatId', 'Hisobot yuboriladigan Chat ID ni kiriting.');
  let chat = clean(value).replace(/^[−–]/, '-');
  if (/^(?:https?:\/\/)?(?:www\.)?t\.me\//i.test(chat)) {
    const match = chat.match(/^(?:https?:\/\/)?(?:www\.)?t\.me\/([a-zA-Z][a-zA-Z0-9_]{4,31})\/?$/i);
    if (!match || ['joinchat', 'share', 'addstickers', 'proxy', 'socks'].includes(match[1].toLowerCase())) throw new SettingsError('chatId', 'Taklif yoki xabar havolasi Chat ID emas. Guruhning -100 bilan boshlanuvchi ID raqamini yoki @username nomini kiriting.');
    chat = `@${match[1]}`;
  }
  if (!/^(?:-?[1-9]\d{0,19}|@[a-zA-Z][a-zA-Z0-9_]{4,31})$/.test(chat)) throw new SettingsError('chatId', 'Chat ID noto‘g‘ri: shaxsiy chatning raqami, guruhning -100… ID raqami yoki @guruh_nomi kerak.');
  return chat;
}
function normalizeTime(value, field) {
  const title = field === 'reportTimeKeldi' ? 'Keldi' : 'Ketdi';
  const match = typeof value === 'string' && clean(value).match(/^(\d{1,2}):([0-5]\d)(?::00)?$/);
  if (!match || Number(match[1]) > 23) throw new SettingsError(field, `${title} hisobot vaqtini 00:00–23:59 oralig‘ida kiriting. Masalan: 09:00.`);
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}
function validateSettings(body) {
  if (typeof (body.token ?? '') !== 'string') throw new SettingsError('token', 'BotFather bergan bot tokenini matn ko‘rinishida kiriting.');
  if (typeof body.enabled !== 'boolean') throw new SettingsError('enabled', 'Avtomatik yuborish holati noto‘g‘ri. Sahifani yangilab qayta saqlang.');
  return { chatId: normalizeChatId(body.chatId), reportTimeKeldi: normalizeTime(body.reportTimeKeldi, 'reportTimeKeldi'), reportTimeKetdi: normalizeTime(body.reportTimeKetdi, 'reportTimeKetdi') };
}
module.exports = { SettingsError, normalizeChatId, normalizeTime, validateSettings };
