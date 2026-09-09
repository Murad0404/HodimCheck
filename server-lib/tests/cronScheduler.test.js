const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { encrypt } = require('../services/telegram');
const { publicOrigin, jobSpec, syncSchedule } = require('../services/cronScheduler');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function company() {
  process.env.TELEGRAM_ENCRYPTION_KEY = 'a'.repeat(64);
  return { _id: 'a'.repeat(24), cronApiKey: encrypt('private-api-key'), cronCallbackSecret: 'private-company-callback', cronSiteUrl: 'https://hodim-check.vercel.app/admin', reportTimeKeldi: '09:15', reportTimeKetdi: '18:45', save: async () => {} };
}
function provider() {
  const jobs = []; const calls = [];
  global.fetch = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : {};
    calls.push({ url, method: options.method, body });
    assert.equal(options.headers.Authorization, 'Bearer private-api-key');
    let result = {};
    if (options.method === 'GET') result = { jobs, someFailed: false };
    if (options.method === 'PUT') { const id = jobs.length + 1; jobs.push({ ...body.job, jobId: id }); result = { jobId: id }; }
    if (options.method === 'PATCH') { const id = Number(url.split('/').pop()); Object.assign(jobs.find(j => j.jobId === id), body.job); }
    return { ok: true, json: async () => result };
  };
  return { jobs, calls };
}
test('daily schedules retain different minutes and contain only company scoped callback secret', () => {
  const c = company(); const arrival = jobSpec(c, 'keldi'); const departure = jobSpec(c, 'ketdi');
  assert.deepEqual(arrival.schedule.hours, [9]); assert.deepEqual(arrival.schedule.minutes, [15]);
  assert.deepEqual(departure.schedule.hours, [18]); assert.deepEqual(departure.schedule.minutes, [45]);
  assert.equal(arrival.schedule.timezone, 'Asia/Tashkent');
  assert.equal(arrival.url, `https://hodim-check.vercel.app/api/cron/telegram?company=${c._id}&type=keldi`);
  assert.ok(!JSON.stringify(arrival).includes('private-api-key'));
  assert.equal(arrival.extendedData.headers.Authorization, 'Bearer private-company-callback');
  assert.equal(arrival.enabled, false);
});
test('creates two jobs once then patches existing jobs when admin changes times', async () => {
  const c = company(); const { jobs, calls } = provider();
  await syncSchedule(c, true);
  assert.equal(jobs.length, 2); assert.ok(jobs.every(j => j.enabled)); assert.equal(c.cronJobKeldi, 1); assert.equal(c.cronJobKetdi, 2);
  c.reportTimeKeldi = '10:25'; await syncSchedule(c, true);
  assert.equal(calls.filter(c => c.method === 'PUT').length, 2);
  assert.deepEqual(jobs[0].schedule.hours, [10]); assert.deepEqual(jobs[0].schedule.minutes, [25]);
  await syncSchedule(c, false); assert.ok(jobs.every(j => !j.enabled));
});
test('recovers a created job after provider accepted request but response was lost', async () => {
  const c = company(); const { jobs, calls } = provider(); const normalFetch = global.fetch;
  let lost = false;
  global.fetch = async (url, options) => {
    const result = await normalFetch(url, options);
    if (options.method === 'PUT' && !lost) { lost = true; throw new Error('lost response'); }
    return result;
  };
  await assert.rejects(syncSchedule(c, true), /javobi olinmadi/);
  assert.equal(jobs.length, 1); assert.equal(jobs[0].enabled, false);
  await syncSchedule(c, true);
  assert.equal(jobs.length, 2); assert.equal(calls.filter(c => c.method === 'PUT').length, 2);
});
test('partial job list and API limits fail visibly without creating duplicate jobs', async () => {
  const c = company(); let writes = 0;
  global.fetch = async (_, options) => { if (options.method !== 'GET') writes++; return { ok: true, json: async () => ({ jobs: [], someFailed: true }) }; };
  await assert.rejects(syncSchedule(c, true), /to‘liq olinmadi/); assert.equal(writes, 0);
  global.fetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(syncSchedule(c, true), /limit/);
});
test('rejects private callback addresses and strips page paths', () => {
  for (const url of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://name.local', 'https://user:password@example.com']) assert.throws(() => publicOrigin(url));
  assert.equal(publicOrigin('https://hodim-check.vercel.app/admin'), 'https://hodim-check.vercel.app');
});
