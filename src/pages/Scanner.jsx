import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { LogOut, QrCode, Calendar, CheckCircle, XCircle } from 'lucide-react';
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
        // If face is enabled but not registered, force scanner mode without loc check for registration
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
    } catch (err) {
      console.error(err);
    }
  };

  const getDistanceFromLatLonInM = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // in meters
  };

  const handleOpenScanner = () => {
    if (!companyData) return;
    if (companyData.location && companyData.location.lat) {
      if (!navigator.geolocation) {
        alert('Sizning qurilmangizda lokatsiya aniqlash imkoni yo\'q');
        return;
      }
      setStatus('Lokatsiya tekshirilmoqda...');
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const distance = getDistanceFromLatLonInM(latitude, longitude, companyData.location.lat, companyData.location.lng);
        if (distance > 100) {
          alert(`Siz ofisdan uzoqdasiz (${Math.round(distance)} metr). Faqat ofis atrofida (100m) skaner qilish mumkin.`);
          setStatus('');
        } else {
          setStatus('');
          setView('scanner');
        }
      }, (err) => {
        alert('Lokatsiyani aniqlash uchun ruxsat bering, aks holda skaner ochilmaydi');
        setStatus('');
      });
    } else {
      // No location restriction set by admin
      setView('scanner');
    }
  };

  useEffect(() => {
    let html5QrCode;
    
    if (view === 'scanner' && !faceCheckRequired && companyData && !scanResult) {
      html5QrCode = new Html5Qrcode('reader');
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
          if(html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
              setScanResult(decodedText);
              if (companyData.faceIdEnabled) {
                setFaceCheckRequired('verify');
              } else {
                markAttendance(decodedText, 'keldi', false);
              }
            }).catch(e => console.error(e));
          }
        }, 
        (errorMessage) => {
          // ignore parsing errors
        }
      ).catch(err => {
        console.error('Kamerani ochishda xatolik', err);
        setStatus('Kamerani ochishda xatolik. Ruxsat berilganligini tekshiring.');
      });
    }
    
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(e => console.error(e));
      }
    };
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
          <button onClick={() => {
            setView('dashboard');
            setStatus('');
          }} className="btn btn-outline" style={{ width: 'auto', padding: '0.4rem 1rem' }}>
            Yopish
          </button>
        </div>

        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {status ? (
            <div className="text-center">
              <h2>{status}</h2>
              {(status.includes('Xato') || status.includes('xatolik')) && (
                <button className="btn btn-primary mt-4" onClick={() => {setStatus(''); setScanResult(null); setFaceCheckRequired(false)}}>Qayta urinish</button>
              )}
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
              <p className="mb-4">Kompaniya QR kodiga qarating</p>
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
      
      {status && <div style={{ color: 'var(--primary)', textAlign: 'center', fontWeight: 'bold' }}>{status}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="btn-icon-large" onClick={handleOpenScanner}>
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
