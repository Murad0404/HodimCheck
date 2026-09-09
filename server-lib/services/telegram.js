const crypto = require('node:crypto');
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function key() {
  const value = process.env.TELEGRAM_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('Serverda TELEGRAM_ENCRYPTION_KEY sozlanmagan');
  return Buffer.from(value, 'hex');
}
function encrypt(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), data.toString('hex')].join(':');
}
function decrypt(value) {
  if (!value.startsWith('v1:')) return value; // Legacy records are encrypted on next save.
  const [, iv, tag, data] = value.split(':');
  const cipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
  cipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'hex')), cipher.final()]).toString('utf8');
}
async function telegram(token, method, body = {}) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
    });
  } catch { throw new Error('Telegram bilan aloqa uzildi. Qayta urinib ko‘ring.'); }
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const messages = {401: 'Bot tokeni noto‘g‘ri.', 403: 'Bot bloklangan yoki chatga yozish huquqi yo‘q.', 400: 'Chat topilmadi yoki bot chatga qo‘shilmagan.', 429: 'Telegram so‘rov limiti. Keyinroq urinib ko‘ring.'};
    const description = String(result.description || '').toLowerCase();
    let message = messages[result.error_code] || 'Telegram so‘rovni bajara olmadi.';
    if (description.includes('blocked') || description.includes('initiate conversation')) message = 'Bot shaxsiy chatga yoza olmayapti. Botni ochib /start bosing va blokdan chiqaring.';
    else if (description.includes('rights') || description.includes('administrator') || description.includes('kicked')) message = 'Botga guruh yoki kanalda xabar yozish huquqini bering.';
    else if (method === 'setWebhook' && result.error_code === 400) message = 'Webhook ulanmagan: sayt HTTPS manzili va Vercel deployini tekshiring.';
    throw new Error(message);
  }
  return result.result;
}
function localClock(now = new Date()) {
  const shifted = new Date(now.getTime() + 5 * 3600000).toISOString();
  return { day: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}
function reportWindow(day, time) {
  return { start: new Date(`${day}T00:00:00+05:00`), end: new Date(`${day}T${time}:00+05:00`) };
}
function reportChunks(company, type, day, rows) {
  const title = `${String(company.name).slice(0, 200)} · ${type === 'keldi' ? 'Keldi' : 'Ketdi'} hisoboti\n${day} · Toshkent vaqti\nJami: ${rows.length} ta qayd\n\n`;
  const lines = rows.map((row, i) => `${i + 1}. ${String(row.userId?.fullName || 'O‘chirilgan xodim').replace(/[\r\n]/g, ' ').slice(0, 150)} — ${localClock(new Date(row.timestamp)).time}`);
  if (!lines.length) lines.push('Hozircha qayd yo‘q.');
  const chunks = []; let current = title;
  for (const line of lines) {
    if (current.length + line.length + 1 > 3500) { chunks.push(current); current = `${day} · Davomi\n`; }
    current += `${line}\n`;
  }
  chunks.push(current); return chunks;
}
module.exports = { TIME, encrypt, decrypt, telegram, localClock, reportWindow, reportChunks };
