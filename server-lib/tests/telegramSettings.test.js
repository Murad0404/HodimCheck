const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeChatId, normalizeTime, validateSettings } = require('../services/telegramSettings');
test('normalizes public group URLs, copied IDs, and numeric IDs', () => {
  assert.equal(normalizeChatId(' https://t.me/hodim_group/ '), '@hodim_group');
  assert.equal(normalizeChatId('\u200e−10012345678\u200f'), '-10012345678');
  assert.equal(normalizeChatId(12345678), '12345678');
});
test('rejects invite links and message links without guessing an ID', () => {
  for (const value of ['https://t.me/+abc', 'https://t.me/joinchat/abc', 'https://t.me/group_name/42', 'guruhim', '', 9007199254740992]) assert.throws(() => normalizeChatId(value), error => error.field === 'chatId');
});
test('normalizes minute precision times, rejects invalid hours and meaningful seconds', () => {
  assert.equal(normalizeTime('9:05', 'reportTimeKeldi'), '09:05');
  assert.equal(normalizeTime('18:30:00', 'reportTimeKetdi'), '18:30');
  for (const value of ['24:00', '09:60', '09:00:30', '', undefined]) assert.throws(() => normalizeTime(value, 'reportTimeKetdi'), error => error.field === 'reportTimeKetdi');
});
test('identifies the specific invalid field', () => {
  const good = { chatId: '-100123456', enabled: true, reportTimeKeldi: '09:00', reportTimeKetdi: '18:00' };
  assert.throws(() => validateSettings({ ...good, reportTimeKeldi: '' }), error => error.field === 'reportTimeKeldi');
  assert.throws(() => validateSettings({ ...good, enabled: 'true' }), error => error.field === 'enabled');
});
