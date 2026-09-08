import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { LogOut, Settings, Users, CalendarDays, PlusCircle, CheckCircle, XCircle } from 'lucide-react';

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
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`/api/company/${user.companyId}/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAttendance(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await fetch(`/api/leave/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setLeaveRequests(data);
    } catch (err) {
      console.error(err);
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

  if (loading || !company) return <div className="text-center mt-5">Yuklanmoqda...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>{company.name} Admin Paneli</h2>
            <p style={{ margin: 0, opacity: 0.7 }}>Kompaniya kodi: <strong>{company.companyCode}</strong></p>
          </div>
          <button onClick={handleLogout} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'auto' }}>
            <LogOut size={18} /> Chiqish
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <button className={`btn ${activeTab === 'main' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('main')} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px', minWidth: '150px' }}>
          <Settings size={20} /> Asosiy sozlamalar
        </button>
        <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('users')} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px', minWidth: '150px' }}>
          <Users size={20} /> Xodimlar
        </button>
        <button className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('attendance')} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px', minWidth: '150px' }}>
          <CalendarDays size={20} /> Davomat Tarixi
        </button>
        <button className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('requests')} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px', minWidth: '150px' }}>
          <CalendarDays size={20} /> So'rovlar
        </button>
      </div>

      {activeTab === 'main' && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>Kompaniya QR Kodi</h3>
          <p>Xodimlar shu kodni skaner qilib keldi-ketdi qiladilar</p>
          <div style={{ background: 'white', padding: '20px', display: 'inline-block', borderRadius: '10px', margin: '1rem 0' }}>
            <QRCodeSVG value={company.qrCodeData} size={250} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4>Lokatsiya Nazorati</h4>
              <p style={{ fontSize: '0.9rem' }}>Xodimlar faqat ofis atrofida (150m radius) QR skaner qila olishadi.</p>
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
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PlusCircle size={20}/> Yangi xodim qo'shish</h3>
            <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label>F.I.SH</label>
                <input type="text" className="form-input" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} required />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label>Lavozim</label>
                <input type="text" className="form-input" value={newUser.position} onChange={e => setNewUser({...newUser, position: e.target.value})} required />
              </div>
              <div style={{ width: '120px' }}>
                <label>Ta'til (kun)</label>
                <input type="number" className="form-input" value={newUser.totalDayOffs} onChange={e => setNewUser({...newUser, totalDayOffs: Number(e.target.value)})} required />
              </div>
              <button type="submit" className="btn btn-success" style={{ height: '42px' }}>Qo'shish</button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
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
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => setDayOffForm({ ...dayOffForm, userId: u._id })}
                        >
                          Dam olish berish
                        </button>
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
              <div className="glass-panel" style={{ padding: '2rem', width: '90%', maxWidth: '400px' }}>
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
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
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
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3>Dam Olish So'rovlari</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {leaveRequests.map(req => (
              <div key={req._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: 'var(--primary)' }}>{req.userId?.fullName} <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>({req.userId?.position})</span></h4>
                  <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem' }}><strong>Sana:</strong> {new Date(req.date).toLocaleDateString('uz-UZ')}</p>
                  {req.reason && <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>Sabab:</strong> {req.reason}</p>}
                </div>
                <div>
                  {req.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-success" style={{ padding: '8px 15px', width: 'auto' }} onClick={() => handleRequestStatus(req._id, 'approved')}>Ruxsat</button>
                      <button className="btn btn-danger" style={{ padding: '8px 15px', width: 'auto' }} onClick={() => handleRequestStatus(req._id, 'rejected')}>Rad etish</button>
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
