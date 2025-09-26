import { Router, Request, Response, response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";

export const createWarehouse = async (req: Request, res: Response) => {
  const {
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
    login_id,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO warehouse (
        warehouse_location,
        login_id,
        warehouse_size,
        warehouse_compliance,
        material_details
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        warehouse_location,
        login_id,
        warehouse_size,
        JSON.stringify(warehouse_compliance || {}),
        JSON.stringify(material_details || {}),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
