require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',          // tighten this to your frontend's domain in production
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Wedding API is running 🎉' });
});

// ─── Routes ───────────────────────────────────────────────────────────────
const userRoutes = require('./routes/users');
app.use('/users', userRoutes);

// ─── 404 catch-all ────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── MongoDB + server start ───────────────────────────────────────────────
const PORT        = process.env.PORT        || 8080;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wedding_timeline';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB:', MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });