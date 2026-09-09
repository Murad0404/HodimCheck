import React, { useEffect, useState } from 'react';
import { Send, Clock3, ShieldCheck, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
export default function TelegramSettings({ companyId }) {
  const [form, setForm] = useState(null);
  const [token, setToken] = useState('');
  const [schedulerApiKey, setSchedulerApiKey] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [invalidField, setInvalidField] = useState('');
  const [dirty, setDirty] = useState(false);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
  async function load() {
    setBusy('load'); setNotice(null);
    try {
      const res = await fetch(`/api/telegram/${companyId}`, { headers }); const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setForm({ ...data, siteUrl: data.siteUrl || 'https://hodim-check.vercel.app' });
    } catch (e) { setNotice({ error: true, text: e.message || 'Ulanishni tekshiring' }); }
    finally { setBusy(''); }
  }
  useEffect(() => { load(); }, [companyId]);
  function change(key, value) { setForm(f => ({ ...f, [key]: value })); setDirty(true); setNotice(null); setInvalidField(''); }
  async function action(event, test = false) {
    event.preventDefault(); setInvalidField(''); setBusy(test ? 'test' : 'save'); setNotice(null);
    try {
      const res = await fetch(`/api/telegram/${companyId}${test ? '/test' : ''}`, { method: test ? 'POST' : 'PUT', headers, ...(test ? {} : { body: JSON.stringify({ token, schedulerApiKey, siteUrl: form.siteUrl, chatId: form.chatId, enabled: form.enabled, reportTimeKeldi: form.reportTimeKeldi, reportTimeKetdi: form.reportTimeKetdi }) }) });
      const data = await res.json(); if (!res.ok) { setInvalidField(data.field || ''); const target = { chatId: 'chat-id', reportTimeKeldi: 'arrival-time', reportTimeKetdi: 'departure-time', token: 'bot-token' }[data.field]; if (target) setTimeout(() => document.getElementById(target)?.focus(), 0); if (data.settingsSaved) { setForm(data); setToken(''); setSchedulerApiKey(''); setDirty(false); } throw new Error(data.message); }
      if (test) setForm(f => ({ ...f, ...data }));
      if (!test) { setForm(data); setToken(''); setSchedulerApiKey(''); setDirty(false); }
      setNotice({ text: data.message });
    } catch (e) { setNotice({ error: true, text: e.message || 'Ulanishni tekshiring' }); }
    finally { setBusy(''); }
  }
  async function extraAction(kind) {
    setBusy(kind); setNotice(null);
    try {
      const res = await fetch(`/api/telegram/${companyId}/${kind}`, { method: kind === 'diagnostics' ? 'GET' : 'POST', headers });
      const data = await res.json(); if (!res.ok) throw new Error(data.message);
      if (kind === 'diagnostics') setDiagnostics(data);
      else { setForm(f => ({ ...f, ...data })); setNotice({ text: data.message }); }
    } catch (e) { setNotice({ error: true, text: e.message }); }
    finally { setBusy(''); }
  }
  const displayTime = value => value ? new Date(value).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : 'Hali yo‘q';
  if (!form) return <div className="glass-panel"><p role="status">{notice?.text || 'Telegram sozlamalari yuklanmoqda…'}</p><button className="btn btn-outline" disabled={!!busy} onClick={load}><RefreshCw size={18}/> Qayta yuklash</button></div>;
  return <div className="telegram-layout">
    <form className="glass-panel telegram-form" onSubmit={action}>
      <div className="section-heading"><div className="integration-icon"><Send size={25}/></div><div><h3>Telegram bot</h3><p>Davomat hisoboti — kerakli vaqtda.</p></div><span className={`connection-state ${form.verifiedAt ? 'connected' : ''}`}>{form.verifiedAt ? 'Xabar yuborish tekshirilgan' : form.configured ? 'Token saqlangan' : 'Ulanmagan'}</span></div>
      <fieldset disabled={!!busy}>
        <div className="form-group"><label htmlFor="bot-token">Bot tokeni</label><input id="bot-token" type="password" className="form-input" value={token} onChange={e => { setToken(e.target.value); setDirty(true); }} placeholder={form.configured ? 'Token saqlangan. Almashtirish uchun kiriting' : 'BotFather bergan token'} autoComplete="new-password" required={!form.configured}/><small><ShieldCheck size={14}/> Token shifrlanib saqlanadi va qayta ko‘rsatilmaydi.</small></div>
        <div className="form-group"><label htmlFor="chat-id">Hisobot yuboriladigan Chat ID</label><input id="chat-id" aria-invalid={invalidField === 'chatId'} className="form-input" value={form.chatId} onChange={e => change('chatId', e.target.value)} placeholder="Masalan: -1001234567890" required/><small>Guruh uchun -100… ID raqami yoki @guruh_nomi. Ommaviy t.me/guruh_nomi havolasi ham mumkin; taklif havolasi mos kelmaydi.</small></div>
        <div className="scheduler-connection">
          <h4>Avtomatik jadvalni ulash</h4>
          <p>Bir marta ulang. Keyin hisobot vaqtlarini shu paneldan boshqarasiz.</p>
          <div className="form-group"><label htmlFor="cron-key">cron-job.org API kaliti</label><input id="cron-key" type="password" autoComplete="new-password" className="form-input" value={schedulerApiKey} onChange={e => { setSchedulerApiKey(e.target.value); setDirty(true); }} placeholder={form.schedulerConfigured ? 'Kalit saqlangan' : 'cron-job.org → Settings → API'} required={form.enabled && !form.schedulerConfigured}/><small>Kalitni <a href="https://console.cron-job.org/settings" target="_blank" rel="noreferrer">cron-job.org sozlamalaridan</a> oling. Bu Telegram bot tokenidan boshqa kalit.</small></div>
          <div className="form-group"><label htmlFor="site-url">Saytingiz manzili</label><input id="site-url" type="url" className="form-input" value={form.siteUrl} onChange={e => change('siteUrl', e.target.value)} placeholder="https://hodim-check.vercel.app" required/><small>Saytga so‘rov faqat ikkita belgilangan vaqtda yuboriladi.</small></div>
          <span className={`connection-state ${form.schedulerStatus === 'synced' ? 'connected' : ''}`}>{({ synced: 'Jadval ulangan', paused: 'Jadval to‘xtatilgan', syncing: 'Jadval yangilanmoqda', error: 'Jadvalni qayta saqlang' })[form.schedulerStatus] || 'Jadval ulanmagan'}</span>
        </div>
        <div className="schedule-heading"><Clock3 size={18}/><h4>Hisobot vaqtlari</h4><span>Toshkent · UTC+5</span></div>
        <div className="schedule-grid"><label className="schedule-card" htmlFor="arrival-time"><span className="schedule-type arrival">Keldi hisoboti</span><input id="arrival-time" aria-invalid={invalidField === 'reportTimeKeldi'} step="60" type="time" className="form-input" value={form.reportTimeKeldi} onChange={e => change('reportTimeKeldi', e.target.value)} required/><small>Bugungi kelish qaydlari</small></label><label className="schedule-card" htmlFor="departure-time"><span className="schedule-type departure">Ketdi hisoboti</span><input id="departure-time" aria-invalid={invalidField === 'reportTimeKetdi'} step="60" type="time" className="form-input" value={form.reportTimeKetdi} onChange={e => change('reportTimeKetdi', e.target.value)} required/><small>Bugungi ketish qaydlari</small></label></div>
        <label className="toggle-row"><span><strong>Avtomatik yuborish</strong><small>Har kuni belgilangan vaqtlarda</small></span><input type="checkbox" role="switch" checked={form.enabled} onChange={e => change('enabled', e.target.checked)}/></label>
        <div className="telegram-actions"><button className="btn btn-primary" type="submit">{busy === 'save' ? 'Tekshirilmoqda…' : 'Sozlamalarni saqlash'}</button><button className="btn btn-outline" type="button" disabled={!form.configured || dirty || !!token} onClick={e => action(e, true)}><Send size={17}/>{busy === 'test' ? 'Yuborilmoqda…' : 'Sinov xabari'}</button></div>
        <div className="telegram-extra-actions"><button type="button" className="btn btn-outline" disabled={!form.configured || dirty} onClick={() => extraAction('report')}>Bugungi hisobotni yuborish</button><button type="button" className="btn btn-outline" disabled={!form.configured} onClick={() => extraAction('diagnostics')}>Ulanishni tekshirish</button></div>
      </fieldset>
      <p className="verification-note">Yangi bot yoki chatni saqlashda bitta tasdiqlash xabari yuboriladi. “Sinov xabari” botning /start, /sinov va /hisobot buyruqlarini ham ulaydi.</p>
      {form.chatTitle && <p className="verification-note">Qabul qiluvchi: <strong>{form.chatTitle}</strong> · {form.chatId}</p>}
      {diagnostics && <div className="bot-diagnostics" role="status"><h4>Ulanish holati</h4><p>Bot buyruqlari: {diagnostics.webhookMatches ? 'Saytga ulangan' : 'Ulanmagan — Sinov xabari tugmasini bosing'}</p>{diagnostics.webhookDeliveryError && <p className="notice-error">{diagnostics.webhookDeliveryError}</p>}<p>Kutilayotgan Telegram xabarlari: {diagnostics.webhookPending ?? 0}</p><p>Oxirgi jadval so‘rovi: {displayTime(diagnostics.lastCronAt)}</p><p>Natija: {diagnostics.lastCronResult || 'Hali so‘rov kelmagan'}</p><ul>{diagnostics.scheduler?.map(s => <li key={s.type}>{s.type === 'keldi' ? 'Keldi' : 'Ketdi'}: {s.found ? s.enabled ? 'Faol' : 'O‘chirilgan' : 'Jadval topilmadi'} · keyingi: {displayTime(s.nextExecution)} · oxirgi: {s.lastStatus === 1 ? 'Muvaffaqiyatli' : s.lastStatus ? 'Xato — cron-job.org tarixini tekshiring' : 'Bajarilmagan'}</li>)}</ul></div>}
      {notice && <div className={`notice ${notice.error ? 'notice-error' : 'notice-success'}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
      {form.schedulerError && <div className="notice notice-error" role="alert">{form.schedulerError}</div>}
      {form.lastError && <div className="notice notice-error">{form.lastError}</div>}
      {form.lastSentAt && <p className="last-delivery"><CheckCircle2 size={15}/> Oxirgi hisobot: {new Date(form.lastSentAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</p>}
    </form>
    <aside className="telegram-guide glass-panel"><span className="eyebrow">ULASH YO‘RIQNOMASI</span><h3>Bot va jadvalni ulang</h3><ol><li><strong>Bot yarating</strong><p>Telegramda @BotFather orqali /newbot buyrug‘ini yuboring va olingan tokenni kiriting.</p></li><li><strong>Chatni tayyorlang</strong><p>Shaxsiy chatda botga /start bosing. Guruh uchun botni guruhga qo‘shing; kanal uchun yozish huquqini bering. Qabul qiluvchi Chat ID raqamini kiriting.</p></li><li><strong>Jadval xizmatini ulang</strong><p>cron-job.org’da bepul akkaunt oching. Settings bo‘limida API kalitini yarating va shu panelga kiriting. Vazifalarni qo‘lda yaratish shart emas.</p></li><li><strong>Vaqtni belgilang</strong><p>Keldi va ketdi vaqtlarini tanlang, saqlang va sinov xabarini yuboring.</p></li></ol>{form.botUsername && <a className="bot-link" href={`https://t.me/${form.botUsername}`} target="_blank" rel="noreferrer">@{form.botUsername}<ExternalLink size={15}/></a>}<div className="guide-note"><Clock3 size={18}/><p>Hisobotda bugun tanlangan vaqtgacha qayd etilgan keldi yoki ketdilar ko‘rsatiladi.</p></div></aside>
  </div>;
}
