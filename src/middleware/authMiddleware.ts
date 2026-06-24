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

const ACCESS_TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

const issueAccessTokenFromRefresh = (
  refreshToken: string,
  res: Response,
): JwtPayloadCustom => {
  const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayloadCustom;

  const newAccessToken = jwt.sign({ id: decoded.id ?? decoded.userId }, JWT_SECRET, {
    expiresIn: "30m",
  });

  const isProd = process.env.NODE_ENV === "production";
  res.cookie("token", newAccessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });

  return decoded;
};

export const protect: RequestHandler = (req, res, next) => {
  const token = (req as any).cookies?.token;
  const refreshToken = (req as any).cookies?.refreshToken;

  if (!token && !refreshToken) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  if (!token && refreshToken) {
    try {
      (req as any).user = issueAccessTokenFromRefresh(refreshToken, res);
      return next();
    } catch {
      return res.status(401).json({ message: "Not authorized, token refresh failed" });
    }
  }

  try {
    // Try to verify access token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayloadCustom;
    (req as any).user = decoded;
    return next();
  } catch (error: any) {
    // If the 7-day refresh token is still valid, keep the user session alive.
    if (refreshToken) {
      try {
        (req as any).user = issueAccessTokenFromRefresh(refreshToken, res);
        return next();
      } catch {
        return res.status(401).json({ message: "Not authorized, token refresh failed" });
      }
    }

    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};
