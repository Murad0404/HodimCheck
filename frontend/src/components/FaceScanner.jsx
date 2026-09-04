import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

export default function FaceScanner({ mode, onComplete }) {
  const videoRef = useRef();
  const [initializing, setInitializing] = useState(true);
  const [status, setStatus] = useState('Kamerani kutmoqda...');

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        startVideo();
      } catch (error) {
        setStatus("Modellarni yuklashda xatolik: " + error.message);
      }
    };
    loadModels();
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        setInitializing(false);
        setStatus(mode === 'register' ? 'Yuzingizni kameraga tuting...' : 'Yuzingiz tekshirilmoqda...');
      })
      .catch((err) => {
        setStatus("Kameraga ruxsat yo'q yoki kamera ishlamayapti");
      });
  };

  const handleVideoOnPlay = async () => {
    if (initializing) return;
    
    setTimeout(async () => {
      if (!videoRef.current) return;
      
      const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();

      if (detections) {
        if (mode === 'register') {
          setStatus('Yuz aniqlandi, saqlanmoqda...');
          registerFace(detections.descriptor);
        } else {
          verifyFace(detections.descriptor);
        }
      } else {
        setStatus('Yuz topilmadi, kameraga yaxshilab qarang');
        handleVideoOnPlay(); // Loop until found
      }
    }, 2000);
  };

  const registerFace = async (descriptor) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/attendance/face-register', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ descriptor: Array.from(descriptor) })
      });
      if (res.ok) {
        const user = JSON.parse(localStorage.getItem('user'));
        user.faceDescriptor = true;
        localStorage.setItem('user', JSON.stringify(user));
        stopVideo();
        onComplete(true);
      } else {
        setStatus('Saqlashda xato');
      }
    } catch(err) {
      setStatus('Tarmoq xatosi');
    }
  };

  const verifyFace = async (descriptor) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/attendance/face-data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if(res.ok && data.descriptor) {
        const savedDescriptor = new Float32Array(data.descriptor);
        const distance = faceapi.euclideanDistance(descriptor, savedDescriptor);
        
        // 0.6 is a standard threshold. Lower is stricter.
        if (distance < 0.6) {
          setStatus('Yuz tasdiqlandi!');
          stopVideo();
          onComplete(true);
        } else {
          setStatus('Yuzingiz mos kelmadi. Qayta urinib ko\'ring');
          setTimeout(() => handleVideoOnPlay(), 2000);
        }
      } else {
        setStatus('Serverda yuz ma\'lumotingiz yo\'q');
        stopVideo();
        onComplete(false);
      }
    } catch(err) {
      setStatus('Tarmoq xatosi');
      stopVideo();
      onComplete(false);
    }
  };

  const stopVideo = () => {
    if(videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  useEffect(() => {
    return () => stopVideo();
  }, []);

  return (
    <div className="text-center">
      <h3 className="mb-4">{status}</h3>
      <div style={{ position: 'relative', width: '100%', maxWidth: '300px', margin: '0 auto', borderRadius: '50%', overflow: 'hidden', border: '4px solid var(--primary)' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          onPlay={handleVideoOnPlay}
          style={{ width: '100%', display: initializing ? 'none' : 'block' }} 
        />
        {initializing && <div style={{ height: '300px', background: '#000' }}>Yuklanmoqda...</div>}
      </div>
    </div>
  );
}
