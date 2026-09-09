const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const service = require('../services/telegram');
const Company = require('../models/Company');
const Attendance = require('../models/Attendance');
const Delivery = require('../models/TelegramDelivery');
const routes = require('../routes/telegram');
const cron = require('../routes/cron');
const originals = { lock: Company.findOneAndUpdate, find: Company.find, byId: Company.findById, update: Company.updateOne, attendance: Attendance.find, init: Delivery.init, deliveryUpdate: Delivery.updateOne, claim: Delivery.findOneAndUpdate, fetch: global.fetch };
function response() { return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } }; }
const route = (router, path, method) => router.stack.find(s => s.route?.path === path && s.route.methods[method]).route.stack[0].handle;
beforeEach(() => { process.env.JWT_SECRET = 'unit-test-jwt-key'; process.env.TELEGRAM_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex'); process.env.CRON_SECRET = 'test-cron'; });
afterEach(() => { Company.findOneAndUpdate = originals.lock; Company.find = originals.find; Company.findById = originals.byId; Company.updateOne = originals.update; Attendance.find = originals.attendance; Delivery.init = originals.init; Delivery.updateOne = originals.deliveryUpdate; Delivery.findOneAndUpdate = originals.claim; global.fetch = originals.fetch; });
test('Toshkent midnight and daily cutoff remain independent of server timezone', () => {
  assert.deepEqual(service.localClock(new Date('2026-09-09T19:01:00Z')), { day: '2026-09-10', time: '00:01' });
  const window = service.reportWindow('2026-09-09', '11:00');
  assert.equal(window.start.toISOString(), '2026-09-08T19:00:00.000Z');
  assert.equal(window.end.toISOString(), '2026-09-09T06:00:00.000Z');
  for (const invalid of ['24:00', '9:00', '11:60', '', undefined]) assert.equal(service.TIME.test(invalid), false);
});
test('token encryption is randomized and detects tampering', () => {
  const token = '123456:fake_token_for_unit_test_only';
  const a = service.encrypt(token), b = service.encrypt(token);
  assert.notEqual(a, b); assert.ok(!a.includes(token)); assert.equal(service.decrypt(a), token);
  assert.throws(() => service.decrypt(a.slice(0, -2) + (a.endsWith('00') ? '01' : '00')));
});
test('long reports split below Telegram limit without dropping employees', () => {
  const rows = Array.from({ length: 220 }, (_, i) => ({ userId: { fullName: `Employee-${i} ` + 'x'.repeat(100) }, timestamp: new Date() }));
  const chunks = service.reportChunks({ name: 'Test company' }, 'keldi', '2026-09-09', rows);
  assert.ok(chunks.length > 1); assert.ok(chunks.every(c => c.length <= 3500));
  assert.equal((chunks.join('').match(/Employee-/g) || []).length, 220);
  assert.match(service.reportChunks({ name: 'Test' }, 'ketdi', '2026-09-09', [])[0], /qayd yo‘q/);
});
test('Telegram transport never leaks bot token through network errors', async () => {
  global.fetch = async () => { throw new Error('https://api.telegram.org/botSECRET/getMe'); };
  await assert.rejects(service.telegram('SECRET', 'getMe'), error => !error.message.includes('SECRET'));
});
test('admin authorization rejects other company and employee access', () => {
  const auth = routes.stack[0].handle;
  for (const user of [{ role: 'employee', companyId: 'abc' }, { role: 'admin', companyId: 'other' }]) {
    const res = response(); let passed = false;
    auth({ params: { id: 'abc' }, headers: { authorization: `Bearer ${jwt.sign(user, process.env.JWT_SECRET || 'supersecretkey123')}` } }, res, () => { passed = true; });
    assert.equal(res.statusCode, 403); assert.equal(passed, false);
  }
});
test('settings response never exposes stored bot token', async () => {
  Company.findById = () => ({ select: async () => ({ telegramBotToken: 'SECRET', telegramEnabled: true, telegramChatId: '123' }) });
  const res = response(); await route(routes, '/:id', 'get')({ params: { id: 'abc' } }, res);
  assert.equal(res.body.configured, true); assert.ok(!JSON.stringify(res.body).includes('SECRET'));
});
test('invalid schedule is rejected before calling Telegram or saving', async () => {
  Company.findById = () => ({ select: async () => ({ save: () => assert.fail('must not save') }) });
  global.fetch = () => assert.fail('must not call Telegram');
  const res = response(); await route(routes, '/:id', 'put')({ params: { id: 'abc' }, body: { token: '', chatId: '123', enabled: true, reportTimeKeldi: '25:00', reportTimeKetdi: '19:00' } }, res);
  assert.equal(res.statusCode, 400);
});
test('cron fails closed without correct secret', async () => {
  const res = response(); await route(cron, '/telegram', 'get')({ headers: {} }, res); assert.equal(res.statusCode, 401);
});
test('cron sends due report once, skips future report, and uses scheduled cutoff', async () => {
  const now = new Date(); const { day, time } = service.localClock(now);
  let state = null, sends = 0, query;
  Company.find = () => ({ select: async () => [{ _id: 'abc', name: 'Test', telegramEnabled: true, telegramBotToken: 'test-token', telegramChatId: '123', reportTimeKeldi: time, reportTimeKetdi: '99:99' }] });
  Company.updateOne = async () => {};
  Delivery.init = async () => {};
  Delivery.updateOne = async (_, change) => {
    if (change.$setOnInsert && !state) state = { ...change.$setOnInsert, chunks: [], save: async () => {} };
    if (change.$set) Object.assign(state, change.$set);
    if (change.$unset) for (const key of Object.keys(change.$unset)) delete state[key];
  };
  Delivery.findOneAndUpdate = async (_, change) => {
    if (state.status === 'sent' || state.leaseUntil > now) return null;
    Object.assign(state, change.$set); return state;
  };
  Attendance.find = q => { query = q; return { populate: () => ({ sort: async () => [] }) }; };
  global.fetch = async () => { sends++; return { ok: true, json: async () => ({ ok: true, result: {} }) }; };
  const handler = route(cron, '/telegram', 'get');
  const req = { headers: { authorization: 'Bearer test-cron' } };
  const first = response(); await handler(req, first); assert.equal(first.body.sent, 1);
  const second = response(); await handler(req, second); assert.equal(second.body.sent, 0);
  assert.equal(sends, 1); assert.equal(query.timestamp.$lt.toISOString(), service.reportWindow(day, time).end.toISOString());
});
test('company callback rejects a wrong secret before querying attendance', async () => {
  Company.findById = () => ({ select: async () => ({ cronCallbackSecret: 'expected-secret' }) });
  Attendance.find = () => assert.fail('No attendance query before authorization');
  const res = response();
  await route(cron, '/telegram', 'get')({ query: { company: 'a'.repeat(24), type: 'keldi' }, headers: { authorization: 'Bearer wrong-secret' } }, res);
  assert.equal(res.statusCode, 401);
});
test('scheduler credentials are redacted from admin settings response', async () => {
  Company.findById = () => ({ select: async () => ({ cronApiKey: 'API_SECRET', cronCallbackSecret: 'CALLBACK_SECRET', telegramBotToken: 'BOT_SECRET', cronSyncStatus: 'synced' }) });
  const res = response(); await route(routes, '/:id', 'get')({ params: { id: 'abc' } }, res);
  assert.equal(res.body.schedulerConfigured, true);
  for (const secret of ['API_SECRET', 'CALLBACK_SECRET', 'BOT_SECRET']) assert.ok(!JSON.stringify(res.body).includes(secret));
});
test('failed scheduler sync saves keys but disables automatic sending with visible error', async () => {
  const c = { _id: 'a'.repeat(24), name: 'Test', save: async () => {} };
  Company.findById = () => ({ select: async () => c });
  Company.findOneAndUpdate = async () => c;
  Company.updateOne = async () => {};
  global.fetch = async url => url.startsWith('https://api.telegram.org') ? { ok: true, json: async () => ({ ok: true, result: { username: 'test_bot' } }) } : { ok: false, status: 429 };
  const res = response();
  await route(routes, '/:id', 'put')({ params: { id: c._id }, body: { token: '123456:fake_token_for_unit_test_only', schedulerApiKey: 'cron-private-key', siteUrl: 'https://hodim-check.vercel.app', chatId: '123', enabled: true, reportTimeKeldi: '09:00', reportTimeKetdi: '18:00' } }, res);
  assert.equal(res.statusCode, 502); assert.equal(res.body.settingsSaved, true);
  assert.equal(c.telegramEnabled, false); assert.equal(c.cronSyncStatus, 'error');
  assert.equal(service.decrypt(c.cronApiKey), 'cron-private-key');
  assert.ok(!JSON.stringify(res.body).includes('cron-private-key'));
});
