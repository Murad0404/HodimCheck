import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCheckUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId })
      });
      const data = await res.json();
      if (res.ok) {
        setIsFirstLogin(data.isFirstLogin);
        setStep(2);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Server xatosi');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (isFirstLogin && password !== confirmPassword) {
      return setError('Parollar mos kelmadi');
    }

    const endpoint = isFirstLogin ? '/api/auth/set-password' : '/api/auth/login';
    
    try {
      const res = await fetch(endpoint, {
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
        <p>{step === 1 ? 'Tizimga kirish uchun xodim raqamingizni kiriting' : (isFirstLogin ? 'Yangi parol yarating' : 'Parolingizni kiriting')}</p>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

      {step === 1 ? (
        <form onSubmit={handleCheckUser}>
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
          <button type="submit" className="btn btn-primary mt-4">Davom etish</button>
        </form>
      ) : (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>{isFirstLogin ? 'Yangi Parol' : 'Parol'}</label>
            <input 
              type="password" 
              className="form-input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isFirstLogin ? "Yangi parol kiriting" : "Parolingizni kiriting"}
              required
            />
          </div>
          {isFirstLogin && (
            <div className="form-group">
              <label>Parolni tasdiqlang</label>
              <input 
                type="password" 
                className="form-input" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Parolni qayta kiriting"
                required
              />
            </div>
          )}
          <button type="submit" className="btn btn-primary mt-4">
            {isFirstLogin ? "Saqlash va Kirish" : "Tizimga kirish"}
          </button>
          <button type="button" onClick={() => setStep(1)} className="btn mt-2" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>
            Orqaga qaytish
          </button>
        </form>
      )}
      
      <p className="text-center mt-4" style={{ fontSize: '0.9rem' }}>
        Kompaniyangizni tizimga qo'shmoqchimisiz? <br/><Link to="/register" style={{ color: 'var(--primary)' }}>Kompaniya Yaratish</Link>
      </p>
    </div>
  );
}
