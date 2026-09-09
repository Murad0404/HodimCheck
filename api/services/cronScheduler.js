const { TIME, decrypt } = require('./telegram');
class SchedulerError extends Error {}
function publicOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new SchedulerError('Saytning to‘liq HTTPS manzilini kiriting.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || host === 'localhost' || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /\.(local|internal|localhost)$/.test(host)) throw new SchedulerError('Ommaviy HTTPS sayt manzilini kiriting.');
  return url.origin;
}
function jobSpec(company, type) {
  const time = company[type === 'keldi' ? 'reportTimeKeldi' : 'reportTimeKetdi'];
  if (!TIME.test(time)) throw new SchedulerError('Hisobot vaqti noto‘g‘ri.');
  const [hour, minute] = time.split(':').map(Number);
  return {
    title: `HodimCheck ${company._id} ${type}`,
    url: `${publicOrigin(company.cronSiteUrl)}/api/cron/telegram?company=${company._id}&type=${type}`,
    enabled: false, saveResponses: false, requestMethod: 0, requestTimeout: 30, redirectSuccess: false,
    schedule: { timezone: 'Asia/Tashkent', expiresAt: 0, hours: [hour], minutes: [minute], mdays: [-1], months: [-1], wdays: [-1] },
    extendedData: { headers: { Authorization: `Bearer ${company.cronCallbackSecret}` } }
  };
}
async function api(key, method, path, body) {
  let response;
  try { response = await fetch(`https://api.cron-job.org${path}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) }); }
  catch { throw new SchedulerError('cron-job.org javobi olinmadi. Sozlamalarni qayta saqlab, jadvalni tekshiring.'); }
  if (!response.ok) throw new SchedulerError(response.status === 429 ? 'cron-job.org so‘rov limiti. Bir oz kutib qayta saqlang.' : 'cron-job.org ulanmadi. API kaliti va akkaunt ruxsatlarini tekshiring.');
  try { return await response.json(); } catch { throw new SchedulerError('cron-job.org javobi tushunarsiz. Qayta saqlang.'); }
}
async function syncSchedule(company, enabled) {
  const key = decrypt(company.cronApiKey);
  // Reconcile before creating: a previous request may have succeeded despite a lost response.
  const list = await api(key, 'GET', '/jobs');
  if (!Array.isArray(list.jobs) || list.someFailed) throw new SchedulerError('Jadvallar to‘liq olinmadi. Qayta saqlang.');
  for (const type of ['keldi', 'ketdi']) {
    const spec = jobSpec(company, type);
    const field = type === 'keldi' ? 'cronJobKeldi' : 'cronJobKetdi';
    const matches = list.jobs.filter(j => j.title === spec.title);
    if (matches.length > 1) throw new SchedulerError('cron-job.org’da takroriy jadvallar bor. Ortiqchasini o‘chiring va qayta saqlang.');
    const existing = matches[0];
    if (existing) company[field] = existing.jobId;
    else if (!enabled) { company[field] = undefined; continue; }
    else {
      // Creating two jobs must respect the provider's one-create-per-second limit.
      if (type === 'ketdi') await new Promise(resolve => setTimeout(resolve, 1100));
      const created = await api(key, 'PUT', '/jobs', { job: spec });
      if (!Number.isInteger(created.jobId)) throw new SchedulerError('Jadval ID olinmadi. Qayta saqlang.');
      company[field] = created.jobId;
      await company.save(); // Persist each ID immediately, before enabling the external job.
    }
    await api(key, 'PATCH', `/jobs/${company[field]}`, { job: { ...spec, enabled } });
  }
}
module.exports = { SchedulerError, publicOrigin, jobSpec, syncSchedule };
