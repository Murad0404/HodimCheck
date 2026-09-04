import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.user.role === 'admin') navigate('/admin');
        else navigate('/scanner');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Server xatosi');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', marginTop: 'auto', marginBottom: 'auto' }}>
      <div className="text-center mb-4">
        <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--primary)', borderRadius: '50%', marginBottom: '1rem' }}>
          <LogIn size={32} color="white" />
        </div>
        <h2>HodimCheck'ga xush kelibsiz</h2>
        <p>Tizimga kirish uchun xodim raqamingizni kiriting</p>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Xodim Raqami (ID)</label>
          <input 
            type="text" 
            className="form-input" 
            value={employeeId} 
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="Masalan: EMP-1234"
            required
          />
        </div>
        <div className="form-group">
          <label>Parol</label>
          <input 
            type="password" 
            className="form-input" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary mt-4">Tizimga kirish</button>
      </form>
      
      <p className="text-center mt-4" style={{ fontSize: '0.9rem' }}>
        Kompaniyangizni tizimga qo'shmoqchimisiz? <br/><Link to="/register" style={{ color: 'var(--primary)' }}>Kompaniya Yaratish</Link>
      </p>
    </div>
  );
}
