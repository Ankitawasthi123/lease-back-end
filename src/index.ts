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
import payuRoutes from "./routes/payuRoutes";
import razorpayRoutes from "./routes/razorpayRoutes";
import { errorHandler, notFound } from './middleware/errorHandler';

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

const configuredOrigins = String(config.CLIENT_URL)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const normalizedOrigin = origin?.trim().replace(/\/$/, "");
    if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin)) {
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
app.use('/api', payuRoutes);  // legacy endpoints forwarded to Razorpay implementation
app.use('/api', razorpayRoutes);

// dump registered routes for debugging
app._router.stack
  .filter((r: any) => r.route)
  .forEach((r: any) => {
    const methods = Object.keys(r.route.methods).join(',');
    console.log(`registered route: ${methods.toUpperCase()} ${r.route.path}`);
  });

app.use(notFound);
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

