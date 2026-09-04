import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { LogOut, ScanFace, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FaceScanner from '../components/FaceScanner';

export default function Scanner() {
  const [scanResult, setScanResult] = useState(null);
  const [faceCheckRequired, setFaceCheckRequired] = useState(false);
  const [companyData, setCompanyData] = useState(null);
  const [status, setStatus] = useState('');
  
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/company/${user.companyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setCompanyData(data);
      if (data.faceIdEnabled && !user.faceDescriptor) {
        setFaceCheckRequired('register');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!faceCheckRequired && companyData && !scanResult) {
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
            markAttendance(decodedText, 'keldi', false); // Default logic, needs UI for choice
          }
        },
        (err) => {}
      );
      
      return () => {
        scanner.clear().catch(e => console.error(e));
      };
    }
  }, [faceCheckRequired, companyData, scanResult]);

  const markAttendance = async (qrData, type, faceVerified) => {
    setStatus('Yuborilmoqda...');
    try {
      const res = await fetch('http://localhost:5000/api/attendance/mark', {
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
        }, 3000);
      } else {
        setStatus(`❌ Xato: ${data.message}`);
      }
    } catch (err) {
      setStatus('❌ Tarmoq xatosi');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="glass-panel flex" style={{ flexDirection: 'column', height: '100%', padding: '1rem' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2"><QrCode /> Davomat</h3>
        <button onClick={handleLogout} className="btn btn-danger" style={{ width: 'auto', padding: '0.4rem' }}>
          <LogOut size={16} />
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
              // Ask user for keldi or ketdi
              setStatus('Yuz tasdiqlandi. Kuting...');
              // Prompt UI simulation for now
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
