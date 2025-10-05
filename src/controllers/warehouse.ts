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

export const getAllWarehouses = async (req: Request, res: Response) => {
  const { login_id } = req.query;
  try {
    let query = `SELECT * FROM warehouse`;
    let values: any[] = [];

    if (login_id) {
      // Return only warehouses belonging to this login_id
      query += ` WHERE login_id = $1`;
      values.push(login_id);
    }
    // Else: no WHERE clause → returns all warehouses

    query += ` ORDER BY id DESC`;

    const result = await pool.query(query, values);
    res.status(200).json({ warehouses: result.rows });
  } catch (err: any) {
    console.error("Error fetching warehouses:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getWarehousesCurrUser = async (req: Request, res: Response) => {
  const { login_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM warehouse WHERE login_id = $1 ORDER BY id DESC`,
      [login_id]
    );
    res.status(200).json({ warehouses: result.rows });
  } catch (err: any) {
    console.error(`Error fetching warehouses for login_id ${login_id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

export const getWarehouseById = async (req: Request, res: Response) => {
  const { login_id, id } = req.params;

  try {
    // Fetch warehouse
    const warehouseResult = await pool.query(
      `SELECT * FROM warehouse WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (warehouseResult.rows.length === 0) {
      return res.status(404).json({ error: "Warehouse not found" });
    }

    const warehouse = warehouseResult.rows[0];

    // Fetch pitches for warehouse
    const pitchesResult = await pool.query(
      `SELECT * FROM pitches WHERE warehouse_id = $1`,
      [id]
    );
    // If pitches exist, add them as a new property on warehouse object
    if (pitchesResult.rows.length > 0) {
      return res.status(200).json({
        ...warehouse,
        pitches: warehouse?.login_id === login_id && pitchesResult.rows,
      });
    }

    // If no pitches, return warehouse as is
    return res.status(200).json(warehouse);
  } catch (err: any) {
    console.error("Error fetching warehouse and pitches:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateWarehouse = async (req: Request, res: Response) => {
  const { login_id, id } = req.body;

  const {
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
  } = req.body;

  try {
    // Check if warehouse exists
    const existing = await pool.query(
      `SELECT * FROM warehouse WHERE login_id = $1 AND id = $2`,
      [login_id, id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "You are not authorize to edit the warehouse details.",
      });
    }

    // Update warehouse
    const result = await pool.query(
      `UPDATE warehouse
       SET warehouse_location = $1,
           warehouse_size = $2,
           warehouse_compliance = $3,
           material_details = $4
       WHERE login_id = $5 AND id = $6
       RETURNING *`,
      [
        warehouse_location,
        warehouse_size,
        JSON.stringify(warehouse_compliance || {}),
        JSON.stringify(material_details || {}),
        login_id,
        id,
      ]
    );

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error updating warehouse:", err);
    res.status(500).json({ error: err.message });
  }
};
