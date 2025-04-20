import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import express from 'express';
import cookieParser from 'cookie-parser';

const JWT_SECRET = process.env.JWT_SECRET || "mysecret";


interface AuthRequest extends Request {
  user?: JwtPayloadCustom;
}

interface JwtPayloadCustom {
  userId: string;
  role: string;
}

export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayloadCustom;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};
