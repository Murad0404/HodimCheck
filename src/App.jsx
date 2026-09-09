import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Scanner = lazy(() => import('./pages/Scanner'));
import logo from './assets/logo.png';

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  return token && user?.role === 'admin' ? children : <Navigate to="/login" />;
};

const ScannerRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

const RootRoute = () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  return token ? (user?.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/scanner" />) : <Navigate to="/login" />;
};

function Shell({ children }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const app = window.Telegram?.WebApp;
    app?.ready(); app?.expand();
    app?.setHeaderColor?.('#ffffff'); app?.setBackgroundColor?.('#f3f6fb');
  }, []);
  return <div className={`container ${pathname === '/admin' ? 'admin-shell' : 'mobile-shell'}`}><header className="brand-bar"><img src={logo} alt="HodimCheck Logo" className="header-logo"/><span>DAVOMAT BOSHQARUVI</span></header>{children}<footer className="app-footer">HodimCheck · Ish kuningiz nazoratda</footer></div>;
}
function App() {
  return (
    <Router>
      <Shell>
        <Suspense fallback={<div className="glass-panel" role="status">Yuklanmoqda…</div>}><Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/scanner" element={<ScannerRoute><Scanner /></ScannerRoute>} />
        </Routes></Suspense>
      </Shell>
    </Router>
  );
}

export default App;
