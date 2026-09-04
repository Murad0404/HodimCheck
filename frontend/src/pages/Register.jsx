import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess({
          adminId: data.admin.employeeId,
          companyCode: data.company.companyCode
        });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Server xatosi');
    }
  };

  if (success) {
    return (
      <div className="glass-panel text-center" style={{ padding: '2rem', marginTop: 'auto', marginBottom: 'auto' }}>
        <h2 style={{ color: 'var(--success)' }}>Kompaniya Yaratildi!</h2>
        <p>Quyidagi ma'lumotlarni saqlab qo'ying:</p>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', margin: '15px 0', textAlign: 'left' }}>
          <p><strong>Admin Login ID (Siz uchun):</strong> <span style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>{success.adminId}</span></p>
          <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '10px 0' }}/>
          <p><strong>Xodimlar uchun Kompaniya Kodi:</strong> {success.companyCode}</p>
        </div>
        <button onClick={() => navigate('/login')} className="btn btn-primary">Tizimga kirish</button>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '2rem', marginTop: 'auto', marginBottom: 'auto' }}>
      <div className="text-center mb-4">
        <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--success)', borderRadius: '50%', marginBottom: '1rem' }}>
          <Building2 size={32} color="white" />
        </div>
        <h2>Kompaniya Yaratish</h2>
        <p>Yangi kompaniya va admin akkaunt ochish</p>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Kompaniya Nomi</label>
          <input type="text" className="form-input" placeholder="Misol: IT Markaz" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Admin Paroli</label>
          <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        
        <button type="submit" className="btn btn-success mt-4">Kompaniya yaratish</button>
      </form>

      <p className="text-center mt-4" style={{ fontSize: '0.9rem' }}>
        Allaqachon ro'yxatdan o'tganmisiz? <Link to="/login" style={{ color: 'var(--primary)' }}>Tizimga kirish</Link>
      </p>
    </div>
  );
}
