import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import Scanner from './pages/Scanner';

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
  return token ? (user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/scanner" />) : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <div className="container">
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/scanner" element={<ScannerRoute><Scanner /></ScannerRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
