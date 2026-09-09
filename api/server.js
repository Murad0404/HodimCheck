const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Serverless Kesh ulanishi (Vercel uchun)
let cachedDb = global.mongoose;
if (!cachedDb) {
  cachedDb = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cachedDb.conn) {
    return cachedDb.conn;
  }
  
  if (!cachedDb.promise && process.env.MONGODB_URI) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    };
    cachedDb.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB Muvaffaqiyatli Ulandi');
      return mongoose;
    }).catch(err => {
      console.error('MongoDB Ulanish Xatosi:', err);
      cachedDb.promise = null;
      throw err;
    });
  }
  cachedDb.conn = await cachedDb.promise;
  return cachedDb.conn;
}

// Har bir so'rovda baza ulanganini tekshiramiz
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    res.status(500).json({ message: 'Baza ulanish xatosi (Serverless)' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
