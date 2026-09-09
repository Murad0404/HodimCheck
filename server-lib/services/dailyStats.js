const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { localClock, reportWindow } = require('./telegram');
function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}
function bounds(day) {
  const start = reportWindow(day, '00:00').start;
  return { start, end: new Date(start.getTime() + 86400000) };
}
function summarize(users, rows, day) {
  const { start, end } = bounds(day);
  const byUser = new Map();
  for (const row of rows) {
    const t = new Date(row.timestamp);
    if (t < start || t >= end) continue;
    const id = String(row.userId?._id || row.userId);
    if (!byUser.has(id)) byUser.set(id, []);
    byUser.get(id).push(row);
  }
  const employees = users.filter(u => u.role !== 'admin' && (!u.createdAt || new Date(u.createdAt) < end)).map(u => {
    const events = (byUser.get(String(u._id)) || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const count = events.length;
    return { id: String(u._id), fullName: u.fullName, employeeId: u.employeeId, position: u.position, count, status: !count ? 'absent' : count % 2 ? 'present' : 'departed', firstArrival: events[0]?.timestamp || null, lastEvent: events.at(-1)?.timestamp || null };
  });
  const present = employees.filter(e => e.status === 'present').length;
  const departed = employees.filter(e => e.status === 'departed').length;
  const total = employees.length;
  return { day, total, present, departed, attended: present + departed, absent: total - present - departed, rate: total ? Math.round((present + departed) * 100 / total) : 0, employees };
}
async function dailyStats(companyId, day = localClock().day, cutoff = new Date()) {
  const { start, end } = bounds(day);
  const until = new Date(Math.min(new Date(cutoff).getTime(), end.getTime()));
  const [users, rows] = await Promise.all([
    User.find({ companyId, role: 'employee' }).select('fullName employeeId position createdAt role').lean(),
    Attendance.find({ companyId, timestamp: { $gte: start, $lt: until } }).select('userId timestamp').lean()
  ]);
  return summarize(users, rows, day);
}
function statsMessages(company, stats, label = 'Kunlik hisobot') {
  const title = `${String(company.name).slice(0, 160)}\n${label} · ${stats.day}\nToshkent vaqti\n\nJami xodimlar: ${stats.total}\nKelganlar: ${stats.attended}\nHozir ishda: ${stats.present}\nKetganlar: ${stats.departed}\nQayd yo‘q: ${stats.absent}\nDavomat: ${stats.rate}%\n\n`;
  const names = { present: 'Kelgan · ishda', departed: 'Ketgan', absent: 'Qayd yo‘q' };
  const chunks = []; let text = title;
  for (const e of stats.employees) {
    const line = `${String(e.fullName).replace(/[\r\n]/g, ' ').slice(0, 120)} — ${names[e.status]} (${e.count} qayd)${e.lastEvent ? ' · ' + localClock(new Date(e.lastEvent)).time : ''}\n`;
    if (text.length + line.length > 3500) { chunks.push(text); text = `${stats.day} · Davomi\n`; }
    text += line;
  }
  chunks.push(text); return chunks;
}
module.exports = { validDay, bounds, summarize, dailyStats, statsMessages };
