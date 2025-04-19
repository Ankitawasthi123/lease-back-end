// userRoutes.ts
import { Router, Request, Response } from "express";
import pool from "../config/db";  // adjust the path if needed

const router = Router();

// Route to get all users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

export default router;