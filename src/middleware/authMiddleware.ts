import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";

// These MUST be set in the environment – no weak fallbacks
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be defined in environment");
}

interface JwtPayloadCustom {
  userId?: string;
  id?: number | string;
  login_id?: number | string;
  role?: string;
  [key: string]: any;
}

export const protect: RequestHandler = (req, res, next) => {
  const token = (req as any).cookies?.token;
  const refreshToken = (req as any).cookies?.refreshToken;

  if (!token && !refreshToken) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    // Try to verify access token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayloadCustom;
    (req as any).user = decoded;
    return next();
  } catch (error: any) {
    // If access token expired but refresh token exists, try to refresh
    if (error.name === "TokenExpiredError" && refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayloadCustom;
        
        // Issue new access token (15 minutes)
        const newAccessToken = jwt.sign({ id: decoded.id }, JWT_SECRET, {
          expiresIn: "15m",
        });

        const isProd = process.env.NODE_ENV === "production";
        // Update token cookie
        res.cookie("token", newAccessToken, {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "strict" : "lax",
          maxAge: 15 * 60 * 1000, // 15 minutes
        });

        (req as any).user = decoded;
        return next();
      } catch (refreshError) {
        return res.status(401).json({ message: "Not authorized, token refresh failed" });
      }
    }

    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};
