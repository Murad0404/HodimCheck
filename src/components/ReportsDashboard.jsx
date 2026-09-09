import React, { useEffect, useState } from 'react';
import { RefreshCw, Users, LogIn, LogOut, UserX, CalendarDays, ArrowUpRight } from 'lucide-react';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
const clock = value => value ? new Date(value).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }) : '—';
const labels = { present: 'Kelgan · ishda', departed: 'Ketgan', absent: 'Qayd yo‘q' };
export default function ReportsDashboard({ companyId }) {
  const [day, setDay] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    fetch(`/api/company/${companyId}/dashboard?day=${encodeURIComponent(day)}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, signal: controller.signal })
      .then(async res => { const body = await res.json(); if (!res.ok) throw new Error(body.message); return body; })
      .then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message || 'Ma’lumot yuklanmadi'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, day, refresh]);
  useEffect(() => { const fn = () => { if (!document.hidden) setRefresh(x => x + 1); }; document.addEventListener('visibilitychange', fn); return () => document.removeEventListener('visibilitychange', fn); }, []);
  const cards = data ? [{ title: 'Jami xodimlar', value: data.total, hint: 'Tanlangan kundagi ro‘yxat', icon: Users, tone: 'navy' }, { title: 'Hozir ishda', value: data.present, hint: 'Toq sondagi qaydlar', icon: LogIn, tone: 'green' }, { title: 'Ketganlar', value: data.departed, hint: 'Juft sondagi qaydlar', icon: LogOut, tone: 'blue' }, { title: 'Qayd yo‘q', value: data.absent, hint: 'Bugun belgilanmagan', icon: UserX, tone: 'gray' }] : [];
  const employees = data?.employees.filter(e => filter === 'all' || e.status === filter) || [];
  return <section className="reports-dashboard">
    <div className="report-toolbar"><div><span className="eyebrow">HODIMCHECK / HISOBOTLAR</span><h2>Davomat manzarasi</h2><p>Ish kunining barcha raqamlari bir joyda.</p></div><div className="report-controls"><label><CalendarDays size={17}/><input aria-label="Hisobot sanasi" type="date" max={today()} value={day} onChange={e => e.target.value && setDay(e.target.value)}/></label><button className="btn btn-outline" onClick={() => setRefresh(x => x + 1)} disabled={loading}><RefreshCw size={16}/> Yangilash</button></div></div>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {loading && <div className="glass-panel" role="status">Hisobot yuklanmoqda…</div>}
    {data && <>
      <div className="report-kpis">{cards.map(({ title, value, hint, icon: Icon, tone }) => <article className={`report-kpi ${tone}`} key={title}><div><span>{title}</span><Icon size={20}/></div><strong>{value}</strong><small>{hint}</small></article>)}</div>
      <div className="report-charts">
        <article className="glass-panel weekly-chart"><div className="chart-heading"><div><h3>So‘nggi 7 kun</h3><p>Kelgan xodimlar soni</p></div><span className="chart-unit">XODIM</span></div>
          <div className="bar-chart" role="group" aria-label={data.series.map(s => `${s.day}: ${s.attended} kelgan, ${s.absent} qaydsiz`).join('; ')}>{data.series.map(s => <button key={s.day} className={`bar-column ${s.day === day ? 'selected' : ''}`} onClick={() => setDay(s.day)} title={`${s.day}: ${s.attended} / ${s.total} xodim`}><span className="bar-number">{s.attended}</span><div className="bar-track"><div className="bar-fill" style={{ height: `${s.total ? s.attended / Math.max(1, ...data.series.map(x => x.total)) * 100 : 0}%` }}/></div><span className="bar-label">{s.day.slice(8)}.{s.day.slice(5,7)}</span></button>)}</div>
          <div className="chart-foot"><span className="legend-dot"/> Kelganlar <span>Joriy xodimlar ro‘yxati bo‘yicha</span></div>
        </article>
        <article className="glass-panel daily-chart"><div className="chart-heading"><div><h3>Kunlik taqsimot</h3><p>{day} · Toshkent vaqti</p></div><ArrowUpRight size={20}/></div><div className="donut-wrap"><div className="attendance-donut" role="img" aria-label={`${data.rate}% davomat; ishda ${data.present}, ketgan ${data.departed}, qayd yo‘q ${data.absent}`} style={{ background: data.total ? `conic-gradient(#0b9278 0 ${data.present/data.total*100}%, #327bd4 ${data.present/data.total*100}% ${(data.present+data.departed)/data.total*100}%, #e8eef5 ${(data.present+data.departed)/data.total*100}% 100%)` : '#e8eef5' }}><div><strong>{data.rate}%</strong><span>davomat</span></div></div></div><div className="donut-legend">{[['present', data.present, 'Ishda'], ['departed', data.departed, 'Ketgan'], ['absent', data.absent, 'Qayd yo‘q']].map(([key,n,label]) => <div key={key}><span className={`legend-dot ${key}`}/><span>{label}</span><strong>{n}</strong></div>)}</div></article>
      </div>
      <article className="glass-panel daily-roster"><div className="chart-heading"><div><h3>Xodimlar holati</h3><p>1 qayd — kelgan · 2 qayd — ketgan · 3 qayd — yana kelgan</p></div><select aria-label="Holat bo‘yicha filtrlash" className="form-input" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Barcha holatlar</option><option value="present">Hozir ishda</option><option value="departed">Ketganlar</option><option value="absent">Qayd yo‘q</option></select></div><div className="roster-scroll"><table><thead><tr><th>Xodim</th><th>Holat</th><th>Birinchi kelish</th><th>Oxirgi qayd</th><th>Qaydlar</th></tr></thead><tbody>{employees.map(e => <tr key={e.id}><td><strong>{e.fullName}</strong><small>{e.position} · {e.employeeId}</small></td><td><span className={`attendance-status ${e.status}`}>{labels[e.status]}</span></td><td>{clock(e.firstArrival)}</td><td>{clock(e.lastEvent)}</td><td>{e.count}</td></tr>)}{!employees.length && <tr><td colSpan="5" className="empty-report">Bu sana va holat uchun xodimlar yo‘q.</td></tr>}</tbody></table></div><small className="report-updated">Yangilandi: {clock(data.updatedAt)} · Sana chegarasi: 00:00–24:00, Toshkent</small></article>
    </>}
  </section>;
}
