// index.js (or server.js)

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import protectedRoutes from './routes/protectedRoutes';

dotenv.config();

const app = express();

// 1️⃣ Configure CORS options
const CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:3000';
const corsOptions = {
  origin: CLIENT_ORIGIN,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,            // if you need to send cookies
  optionsSuccessStatus: 200,    // for legacy browsers
};

// 2️⃣ Apply CORS middleware
app.use(cors(corsOptions));

// 3️⃣ Explicitly handle preflight for *all* routes
app.options('*', cors(corsOptions));

// 4️⃣ Body parser
app.use(express.json());

// 5️⃣ Your routes
app.use('/api', userRoutes);          // e.g. POST /api/signup
app.use('/api/auth', authRoutes);
app.use('/api/private', protectedRoutes);

// 6️⃣ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
