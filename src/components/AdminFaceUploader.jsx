import React, { useState, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Camera } from 'lucide-react';

export default function AdminFaceUploader({ userId, companyId, onComplete, onCancel }) {
  const [status, setStatus] = useState('Rasmni tanlang');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setStatus('Modellar yuklanmoqda...');

    try {
      // 1. Load models
      const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);

      setStatus('Rasm tahlil qilinmoqda...');

      // 2. Read image
      const img = await faceapi.bufferToImage(file);

      // 3. Detect face
      const detections = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();

      if (!detections) {
        setStatus('Rasmda yuz topilmadi. Boshqa rasm sinab ko\'ring.');
        setLoading(false);
        return;
      }

      setStatus('Yuz aniqlandi, serverga yuborilmoqda...');

      // 4. Send to server
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/company/${companyId}/users/${userId}/face`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ descriptor: Array.from(detections.descriptor) })
      });

      if (res.ok) {
        setStatus('Yuz muvaffaqiyatli saqlandi!');
        setTimeout(() => onComplete(), 1500);
      } else {
        const data = await res.json();
        setStatus(data.message || 'Saqlashda xatolik yuz berdi');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setStatus('Xatolik yuz berdi: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
        <h3><Camera size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Yuzni yuklash</h3>
        <p style={{ marginBottom: '1.5rem' }}>Xodimning old tomondan olingan, aniq rasmini yuklang.</p>
        
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
        />
        
        <div style={{ marginBottom: '1.5rem', fontWeight: '500', color: loading ? 'var(--primary)' : 'inherit' }}>
          {status}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => fileInputRef.current.click()} 
            disabled={loading}
            style={{ flex: 1, padding: '0.8rem' }}
          >
            Rasm tanlash
          </button>
          <button 
            className="btn btn-danger" 
            onClick={onCancel} 
            disabled={loading && status.includes('yuborilmoqda')}
            style={{ flex: 1, padding: '0.8rem' }}
          >
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
}
