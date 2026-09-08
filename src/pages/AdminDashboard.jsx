import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { LogOut, Settings, Users, CalendarDays, PlusCircle, CheckCircle, XCircle, Camera } from 'lucide-react';
import AdminFaceUploader from '../components/AdminFaceUploader';

export default function AdminDashboard() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('main'); // main, users, attendance
  
  // Data states
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  
  // Forms
  const [newUser, setNewUser] = useState({ fullName: '', position: 'Dasturchi', totalDayOffs: 24 });
  const [dayOffForm, setDayOffForm] = useState({ userId: null, date: '', reason: '' });
  const [faceUploadUserId, setFaceUploadUserId] = useState(null);
  
  const [telegramSettings, setTelegramSettings] = useState({
    telegramBotToken: '',
    reportTimeKeldi: '11:00',
    reportTimeKetdi: '19:00'
  });
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchCompanyData = async () => {
    try {
      const res = await fetch(`/api/company/${user.companyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setCompany(data);
      setTelegramSettings({
        telegramBotToken: data.telegramBotToken || '',
        reportTimeKeldi: data.reportTimeKeldi || '11:00',
        reportTimeKetdi: data.reportTimeKetdi || '19:00'
      });
      setSubscriberCount(data.telegramSubscribers?.length || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/company/${user.companyId}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('Failed to fetch users:', data);
        setUsers([]);
      }
    } catch (err) {
      console.error(err);
      setUsers([]);
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`/api/company/${user.companyId}/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setAttendance(data);
      } else {
        console.error('Failed to fetch attendance:', data);
        setAttendance([]);
      }
    } catch (err) {
      console.error(err);
      setAttendance([]);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await fetch(`/api/leave/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setLeaveRequests(data);
      } else {
        console.error('Failed to fetch leave requests:', data);
        setLeaveRequests([]);
      }
    } catch (err) {
      console.error(err);
      setLeaveRequests([]);
    }
  };

  useEffect(() => {
    fetchCompanyData().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'attendance') fetchAttendance();
    if (activeTab === 'requests') fetchLeaveRequests();
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/company/${user.companyId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        alert('Xodim qo\'shildi! Paroli: 123456');
        setNewUser({ fullName: '', position: 'Dasturchi', totalDayOffs: 24 });
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGiveDayOff = async (e) => {
    e.preventDefault();
    if (!dayOffForm.userId || !dayOffForm.date) return;
    try {
      const res = await fetch(`/api/company/${user.companyId}/users/${dayOffForm.userId}/dayoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ date: dayOffForm.date, reason: dayOffForm.reason })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Dam olish kuni belgilandi');
        setDayOffForm({ userId: null, date: '', reason: '' });
        fetchUsers();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/leave/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchLeaveRequests();
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetLocation = () => {
    if (!navigator.geolocation) {
      alert('Sizning qurilmangizda lokatsiya aniqlash imkoni yo\'q');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const res = await fetch(`/api/company/${user.companyId}/location`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ lat: latitude, lng: longitude })
        });
        const data = await res.json();
        if (res.ok) {
          setCompany({ ...company, location: data.location });
          alert('Ofis lokatsiyasi saqlandi!');
        } else {
          alert(data.message);
        }
      } catch (err) {
        alert('Server xatosi');
      }
    }, () => {
      alert('Lokatsiyani aniqlash uchun ruxsat bering');
    });
  };

  const toggleFaceId = async (enabled) => {
    try {
      await fetch(`/api/company/${user.companyId}/faceid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ enabled })
      });
      setCompany({ ...company, faceIdEnabled: enabled });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTelegram = async () => {
    const currentToken = telegramSettings.telegramBotToken.trim();

    if (!currentToken) {
      alert('Iltimos Bot Tokenini kiriting!');
      return;
    }
    try {
      const res = await fetch(`/api/company/${user.companyId}/telegram`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(telegramSettings)
      });
      const data = await res.json();
      if (res.ok) {
        if (data.webhookSet) {
          alert('✅ ' + data.message);
        } else {
          alert('⚠️ ' + data.message);
        }
        setSubscriberCount(data.subscriberCount || 0);
        fetchCompanyData();
      } else {
        alert('❌ ' + (data.message || 'Saqlashda xatolik'));
      }
    } catch (err) {
      console.error(err);
      alert('Tarmoq xatosi.');
    }
  };

  const handleTestTelegram = async () => {
    const currentToken = telegramSettings.telegramBotToken.trim();

    if (!currentToken) {
      alert('Iltimos avval Bot Tokenini kiriting!');
      return;
    }
    try {
      // Avval sozlamalarni saqlaymiz va webhook o'rnatamiz
      const saveRes = await fetch(`/api/company/${user.companyId}/telegram`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(telegramSettings)
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        alert('❌ Sozlamalarni saqlashda xato: ' + (saveData.message || 'Noma\'lum xato'));
        return;
      }
      setSubscriberCount(saveData.subscriberCount || 0);
      
      // Keyin test xabar yuboramiz
      const res = await fetch(`/api/cron/test-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ token: currentToken, companyId: user.companyId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
      } else {
        let errorMsg = data.message || 'Noma\'lum xato';
        if (errorMsg.includes('Unauthorized')) {
          errorMsg = 'Bot tokeni noto\'g\'ri! BotFather dan tekshirib oling.';
        } else if (errorMsg.includes('bot was blocked')) {
          errorMsg = 'Bot bloklangan! Telegramda botga kirib /start bosing.';
        }
        alert('❌ ' + errorMsg);
      }
    } catch (err) {
      console.error('Telegram test xatosi:', err);
      alert('❌ Tarmoq xatosi: Server bilan bog\'lanib bo\'lmadi.');
    }
  };

  if (loading || !company) return <div className="text-center mt-5">Yuklanmoqda...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
      <div className="glass-panel" style={{ marginBottom: '1rem' }}>
        <div className="admin-header">
          <div>
            <h2 style={{ margin: 0 }}>{company.name} Admin Paneli</h2>
            <p style={{ margin: 0, opacity: 0.7 }}>Kompaniya kodi: <strong>{company.companyCode}</strong></p>
          </div>
          <button onClick={handleLogout} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut size={18} /> Chiqish
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`btn ${activeTab === 'main' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('main')}>
          <Settings size={20} /> Asosiy sozlamalar
        </button>
        <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('users')}>
          <Users size={20} /> Xodimlar
        </button>
        <button className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('attendance')}>
          <CalendarDays size={20} /> Davomat Tarixi
        </button>
        <button className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('requests')}>
          <CalendarDays size={20} /> So'rovlar
        </button>
      </div>

      {activeTab === 'main' && (
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h3>Kompaniya QR Kodi</h3>
          <p>Xodimlar shu kodni skaner qilib keldi-ketdi qiladilar</p>
          <div className="qr-container">
            <QRCodeSVG value={company.qrCodeData} size={250} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4>Lokatsiya Nazorati</h4>
              <p style={{ fontSize: '0.9rem' }}>Xodimlar faqat ofis atrofida (100m radius) QR skaner qila olishadi.</p>
              {company.location?.lat ? (
                <div style={{ margin: '1rem 0', color: 'var(--success)' }}>
                  <strong>Ofis lokatsiyasi o'rnatilgan:</strong> {company.location.lat.toFixed(6)}, {company.location.lng.toFixed(6)}
                </div>
              ) : (
                <div style={{ margin: '1rem 0', color: 'var(--danger)' }}>
                  Ofis lokatsiyasi hali o'rnatilmagan! Xodimlar hozir hamma joydan skaner qila olishadi.
                </div>
              )}
              <button className="btn btn-primary" onClick={handleSetLocation} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                Hozirgi turgan joyni ofis deb saqlash
              </button>
            </div>

            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4>Face ID Sozlamalari</h4>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', marginTop: '1rem' }}>
                <input 
                  type="checkbox" 
                  checked={company.faceIdEnabled} 
                  onChange={(e) => toggleFaceId(e.target.checked)} 
                  style={{ width: '20px', height: '20px' }}
                />
                Face ID yordamida tasdiqlashni majburiy qilish
              </label>
            </div>

            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4>Telegram Bot Sozlamalari</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Hisobotlarni avtomatik Telegramga yuborish tizimini sozlash</p>
              {subscriberCount > 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--success)', marginBottom: '1rem' }}>👥 <strong>{subscriberCount}</strong> ta obunachi ulangan</p>
              )}
              <button className="btn btn-outline" onClick={() => setShowTelegramModal(true)} style={{ width: '100%', padding: '0.8rem' }}>
                Telegram botni ulash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Modal */}
      {showTelegramModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '10px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Telegram Bot Sozlamalari</h3>
            
            <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 8px 0' }}>📋 <strong>Qanday ishlaydi:</strong></p>
              <p style={{ margin: '0 0 5px 0' }}>1. BotFather dan bot token oling</p>
              <p style={{ margin: '0 0 5px 0' }}>2. "Saqlash" tugmasini bosing — webhook avtomatik o'rnatiladi</p>
              <p style={{ margin: '0 0 5px 0' }}>3. Telegramda botingizni oching va <b>/start</b> bosing</p>
              <p style={{ margin: 0 }}>4. Botga /start bergan <b>hamma</b>ga hisobot yuboriladi!</p>
            </div>
            
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Bot Tokeni (BotFather dan)</label>
              <input type="text" className="form-input" value={telegramSettings.telegramBotToken} onChange={e => setTelegramSettings({...telegramSettings, telegramBotToken: e.target.value})} placeholder="123456:ABC-DEF..." />
            </div>

            {subscriberCount > 0 && (
              <div style={{ padding: '0.8rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', marginTop: '1rem', textAlign: 'center' }}>
                <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>👥 {subscriberCount} ta obunachi</span>
              </div>
            )}
            {subscriberCount === 0 && telegramSettings.telegramBotToken && (
              <div style={{ padding: '0.8rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px', marginTop: '1rem', textAlign: 'center' }}>
                <span style={{ color: '#eab308', fontSize: '0.85rem' }}>⚠️ Hali hech kim /start bosmagan. Avval saqlang, keyin botga /start bosing!</span>
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '1rem' }}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label>"Keldi" Vaqti</label>
                <input type="time" className="form-input" value={telegramSettings.reportTimeKeldi} onChange={e => setTelegramSettings({...telegramSettings, reportTimeKeldi: e.target.value})} />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label>"Ketdi" Vaqti</label>
                <input type="time" className="form-input" value={telegramSettings.reportTimeKetdi} onChange={e => setTelegramSettings({...telegramSettings, reportTimeKetdi: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={handleTestTelegram} style={{ padding: '0.8rem' }}>📨 Test Xabar Yuborish ({subscriberCount} ta obunachiga)</button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-success" onClick={() => { handleSaveTelegram(); setShowTelegramModal(false); }} style={{ flex: 1, padding: '0.8rem' }}>Saqlash</button>
                <button className="btn btn-danger" onClick={() => setShowTelegramModal(false)} style={{ flex: 1, padding: '0.8rem' }}>Yopish</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PlusCircle size={20}/> Yangi xodim qo'shish</h3>
            <form onSubmit={handleAddUser} className="add-user-form">
              <div>
                <label>F.I.SH</label>
                <input type="text" className="form-input" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} required />
              </div>
              <div>
                <label>Lavozim</label>
                <input type="text" className="form-input" value={newUser.position} onChange={e => setNewUser({...newUser, position: e.target.value})} required />
              </div>
              <div>
                <label>Ta'til (kun)</label>
                <input type="number" className="form-input" value={newUser.totalDayOffs} onChange={e => setNewUser({...newUser, totalDayOffs: Number(e.target.value)})} required />
              </div>
              <button type="submit" className="btn btn-success" style={{ height: '42px' }}>Qo'shish</button>
            </form>
          </div>

          <div className="glass-panel">
            <h3>Xodimlar Ro'yxati</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>ID</th>
                    <th style={{ padding: '12px' }}>F.I.SH</th>
                    <th style={{ padding: '12px' }}>Lavozim</th>
                    <th style={{ padding: '12px' }}>Dam Olish (Ishlatilgan / Jami)</th>
                    <th style={{ padding: '12px' }}>Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.role !== 'admin').map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>{u.employeeId}</td>
                      <td style={{ padding: '12px' }}>{u.fullName}</td>
                      <td style={{ padding: '12px' }}>{u.position}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ color: (u.usedDayOffs || 0) >= (u.totalDayOffs || 0) ? 'var(--danger)' : 'var(--success)' }}>
                          {u.usedDayOffs || 0} / {u.totalDayOffs || 0} kun
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                            onClick={() => setDayOffForm({ ...dayOffForm, userId: u._id })}
                          >
                            Dam olish
                          </button>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                            onClick={() => setFaceUploadUserId(u._id)}
                          >
                            <Camera size={14} style={{ marginRight: '4px' }}/> Yuz yuklash
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.filter(u => u.role !== 'admin').length === 0 && (
                    <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', opacity: 0.6 }}>Xodimlar yo'q</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dam olish berish modali */}
          {dayOffForm.userId && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="glass-panel" style={{ width: '90%', maxWidth: '400px' }}>
                <h3>Dam Olish Kuni Belgilash</h3>
                <p>Xodim: {users.find(u => u._id === dayOffForm.userId)?.fullName}</p>
                <form onSubmit={handleGiveDayOff}>
                  <div className="form-group">
                    <label>Sana</label>
                    <input type="date" className="form-input" value={dayOffForm.date} onChange={e => setDayOffForm({...dayOffForm, date: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Sababi (Izoh)</label>
                    <input type="text" className="form-input" value={dayOffForm.reason} onChange={e => setDayOffForm({...dayOffForm, reason: e.target.value})} placeholder="Masalan: Kasallik tufayli" required />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Tasdiqlash</button>
                    <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={() => setDayOffForm({ userId: null, date: '', reason: '' })}>Bekor qilish</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Yuz yuklash modali */}
          {faceUploadUserId && (
            <AdminFaceUploader 
              userId={faceUploadUserId} 
              companyId={company._id} 
              onComplete={() => {
                setFaceUploadUserId(null);
                fetchUsers();
              }}
              onCancel={() => setFaceUploadUserId(null)}
            />
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="glass-panel">
          <h3>Kompaniya Davomat Tarixi</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Sana & Vaqt</th>
                  <th style={{ padding: '12px' }}>Xodim (ID)</th>
                  <th style={{ padding: '12px' }}>Holat</th>
                  <th style={{ padding: '12px' }}>Yuz Tasdig'i</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(a => (
                  <tr key={a._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px' }}>{new Date(a.timestamp).toLocaleString('uz-UZ')}</td>
                    <td style={{ padding: '12px' }}>{a.fullName} <span style={{ opacity: 0.5 }}>({a.employeeId})</span></td>
                    <td style={{ padding: '12px' }}>
                      {a.type === 'keldi' ? (
                        <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle size={16}/> Kelgan</span>
                      ) : (
                        <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px' }}><XCircle size={16}/> Ketgan</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {a.faceVerified ? <span style={{ color: 'var(--success)' }}>Ha</span> : <span style={{ color: 'var(--danger)' }}>Yo'q</span>}
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr><td colSpan="4" style={{ padding: '12px', textAlign: 'center', opacity: 0.6 }}>Hali hech qanday davomat qayd etilmagan</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="glass-panel">
          <h3>Dam Olish So'rovlari</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {leaveRequests.map(req => (
              <div key={req._id} className="request-item">
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: 'var(--primary)' }}>{req.userId?.fullName} <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>({req.userId?.position})</span></h4>
                  <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem' }}><strong>Sana:</strong> {new Date(req.date).toLocaleDateString('uz-UZ')}</p>
                  {req.reason && <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>Sabab:</strong> {req.reason}</p>}
                </div>
                <div>
                  {req.status === 'pending' ? (
                    <div className="request-actions">
                      <button className="btn btn-success" style={{ padding: '8px 15px' }} onClick={() => handleRequestStatus(req._id, 'approved')}>Ruxsat</button>
                      <button className="btn btn-danger" style={{ padding: '8px 15px' }} onClick={() => handleRequestStatus(req._id, 'rejected')}>Rad etish</button>
                    </div>
                  ) : (
                    <span className={`status-badge status-${req.status}`}>
                      {req.status === 'approved' ? 'Tasdiqlangan' : 'Rad etilgan'}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {leaveRequests.length === 0 && (
              <p className="text-center" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Hozircha so'rovlar yo'q</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
