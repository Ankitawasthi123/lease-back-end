import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import config from './config/env';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import protectedRoutes from './routes/protectedRoutes';
import mapRoutes from "./routes/mapRoutes"
import adminRoutes from "./routes/adminRoutes"

dotenv.config();

const app = express();
app.use(cookieParser());

// Security middlewares
app.use(helmet());
app.use(hpp());

// Basic rate limiting
app.set('trust proxy', 1);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '..', 'uploads'))
);

const allowedOrigins = new Set([
  config.CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

app.use(express.json());

app.use('/api', userRoutes);         
app.use('/api/auth', authRoutes);
app.use('/api', protectedRoutes);
app.use('/api', mapRoutes);
app.use('/api/admin', adminRoutes);

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

