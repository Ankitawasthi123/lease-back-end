import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";
import jwt from "jsonwebtoken";
import {
  companyRequirments,
  updateCompanyRequirements,
  deleteCompanyRequirements,
  getCurrRequirments,
} from "../controllers/companyRequirementsController";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

router.post("/company/requirements", companyRequirments);
router.post("/company/updaterequirments", updateCompanyRequirements);
router.post("/company/deleterequirments", deleteCompanyRequirements);
router.post("/company/requirement-list", getCurrRequirments);

router.get("/user/profile", protect, async (req: Request, res: Response) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
    };
    const userId = decoded.id;
    const result = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [userId]
    );
    console.log("User result:", result.rows);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = result.rows[0];
    res.json(user);
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: "Database or server error" });
  }
});

export default router;
