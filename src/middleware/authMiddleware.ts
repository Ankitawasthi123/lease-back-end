import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

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
  let token = req.headers.authorization?.split(" ")[1];
 
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayloadCustom;
    console.log(
      "=======================================================================", decoded
    );
    req.user = decoded;
    
    // Optional: check role here (example: only admin can pass)
    // if (req.user.role !== "admin") {
    //   return res.status(403).json({ message: "Forbidden: Admins only" });
    // }

    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};
