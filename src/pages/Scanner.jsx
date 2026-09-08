import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { LogOut, ScanFace, QrCode, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FaceScanner from '../components/FaceScanner';

export default function Scanner() {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'scanner', 'leave'
  const [scanResult, setScanResult] = useState(null);
  const [faceCheckRequired, setFaceCheckRequired] = useState(false);
  const [companyData, setCompanyData] = useState(null);
  const [status, setStatus] = useState('');
  
  // Leave request states
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveError, setLeaveError] = useState('');
  const [userData, setUserData] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompanyData();
    fetchLeaveRequests();
    
    // Auto logout if no user
    if (!user || !user.id) {
      navigate('/login');
    }
  }, []);

  const fetchCompanyData = async () => {
    try {
      const res = await fetch(`/api/company/${user.companyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setCompanyData(data);
      if (data.faceIdEnabled && !user.faceDescriptor) {
        // If face is enabled but not registered, force scanner mode
        setView('scanner');
        setFaceCheckRequired('register');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await fetch('/api/leave/my-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setLeaveRequests(Array.isArray(data) ? data : []);
      
      // Also fetch updated user info for day off counts (we can use the login payload or just fetch it here. Since there isn't a dedicated /me endpoint, we'll extract it from the requests context or rely on localstorage, but localstorage might be stale. We can fetch users list if we had permission, but we don't. For now, we will just use the token user data, but wait, usedDayOffs isn't in token).
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (view === 'scanner' && !faceCheckRequired && companyData && !scanResult) {
      const scanner = new Html5QrcodeScanner('reader', { 
        qrbox: { width: 250, height: 250 }, 
        fps: 5 
      });
      
      scanner.render(
        (decodedText) => {
          scanner.clear();
          setScanResult(decodedText);
          if (companyData.faceIdEnabled) {
            setFaceCheckRequired('verify');
          } else {
            markAttendance(decodedText, 'keldi', false); // Default logic
          }
        },
        (err) => {}
      );
      
      return () => {
        scanner.clear().catch(e => console.error(e));
      };
    }
  }, [view, faceCheckRequired, companyData, scanResult]);

  const markAttendance = async (qrData, type, faceVerified) => {
    setStatus('Yuborilmoqda...');
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ qrData, type, faceVerified })
      });
      const data = await res.json();
      if(res.ok) {
        setStatus(`✅ ${data.message}`);
        setTimeout(() => {
          setScanResult(null);
          setFaceCheckRequired(false);
          setStatus('');
          setView('dashboard');
        }, 3000);
      } else {
        setStatus(`❌ Xato: ${data.message}`);
      }
    } catch (err) {
      setStatus('❌ Tarmoq xatosi');
    }
  };

  const submitLeaveRequest = async (e) => {
    e.preventDefault();
    setLeaveError('');
    try {
      const res = await fetch('/api/leave/request', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: leaveDate, reason: leaveReason })
      });
      const data = await res.json();
      if (res.ok) {
        setView('dashboard');
        setLeaveDate('');
        setLeaveReason('');
        fetchLeaveRequests();
      } else {
        setLeaveError(data.message);
      }
    } catch (err) {
      setLeaveError('Tarmoq xatosi');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (view === 'scanner') {
    return (
      <div className="glass-panel flex" style={{ flexDirection: 'column', height: '100%', padding: '1rem' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2" style={{margin:0}}><QrCode /> Skaner</h3>
          <button onClick={() => setView('dashboard')} className="btn btn-outline" style={{ width: 'auto', padding: '0.4rem 1rem' }}>
            Yopish
          </button>
        </div>

        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {status ? (
            <div className="text-center">
              <h2>{status}</h2>
              <button className="btn btn-primary mt-4" onClick={() => {setStatus(''); setScanResult(null); setFaceCheckRequired(false)}}>Qayta urinish</button>
            </div>
          ) : faceCheckRequired === 'register' ? (
            <FaceScanner mode="register" onComplete={() => setFaceCheckRequired(false)} />
          ) : faceCheckRequired === 'verify' ? (
            <FaceScanner mode="verify" onComplete={(success) => {
              if(success) {
                setStatus('Yuz tasdiqlandi. Kuting...');
                if(window.confirm('Keldingizmi? (Cancel = Ketdim)')) {
                  markAttendance(scanResult, 'keldi', true);
                } else {
                  markAttendance(scanResult, 'ketdi', true);
                }
              } else {
                setStatus('❌ Yuz tasdiqlanmadi');
              }
            }} />
          ) : !scanResult ? (
            <div className="text-center">
              <p className="mb-4">Kompaniya QR kodini skaner qiling</p>
              <div id="reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}></div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (view === 'leave') {
    return (
      <div className="glass-panel" style={{ padding: '2rem', marginTop: 'auto', marginBottom: 'auto' }}>
        <div className="text-center mb-4">
          <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(11, 57, 104, 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
            <Calendar size={32} color="var(--primary)" />
          </div>
          <h2>Dam Olish Kuni So'rash</h2>
          <p>Qachon dam olmoqchisiz?</p>
        </div>

        {leaveError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>{leaveError}</div>}

        <form onSubmit={submitLeaveRequest}>
          <div className="form-group">
            <label>Sana</label>
            <input 
              type="date" 
              className="form-input" 
              value={leaveDate}
              onChange={e => setLeaveDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Sabab (ixtiyoriy)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Masalan: Tobim qochdi"
              value={leaveReason}
              onChange={e => setLeaveReason(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn btn-primary mt-4">So'rov yuborish</button>
          <button type="button" onClick={() => setView('dashboard')} className="btn mt-2" style={{ background: 'transparent', color: 'var(--text-secondary)' }}>
            Bekor qilish
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ margin: 0 }}>Assalomu alaykum,</h2>
          <p style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: '600' }}>{user.fullName}</p>
        </div>
        <button onClick={handleLogout} className="btn btn-danger" style={{ width: 'auto', padding: '0.5rem', borderRadius: '50%' }}>
          <LogOut size={20} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="btn-icon-large" onClick={() => setView('scanner')}>
          <QrCode size={40} />
          <span>QR Skaner</span>
        </div>
        <div className="btn-icon-large" onClick={() => setView('leave')} style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
          <Calendar size={40} />
          <span style={{ textAlign: 'center' }}>Dam Olish So'rash</span>
        </div>
      </div>

      <div style={{ flexGrow: 1, overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>So'rovlaringiz tarixi</h3>
        {leaveRequests.length === 0 ? (
          <p className="text-center" style={{ marginTop: '2rem' }}>Hali hech qanday so'rov yo'q</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {leaveRequests.map(req => (
              <div key={req._id} style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{new Date(req.date).toLocaleDateString('uz-UZ')}</div>
                  {req.reason && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{req.reason}</div>}
                </div>
                <div className={`status-badge status-${req.status}`}>
                  {req.status === 'pending' && 'Kutilmoqda'}
                  {req.status === 'approved' && 'Tasdiqlandi'}
                  {req.status === 'rejected' && 'Rad etildi'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
