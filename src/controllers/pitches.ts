import { Request, Response } from "express";
import pool from "../config/db";

// Create Pitch
export const createPitch = async (req: Request, res: Response) => {
  const {
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
    pitch_id,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO pitches (
        warehouse_location,
        login_id,
        warehouse_size,
        warehouse_compliance,
        material_details
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        warehouse_location,
        pitch_id, // now using pitch_id instead of login_id
        warehouse_size,
        JSON.stringify(warehouse_compliance || {}),
        JSON.stringify(material_details || {}),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error creating pitch:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get All Pitches (optionally filter by pitch_id)
export const getAllPitches = async (req: Request, res: Response) => {
  const { pitch_id } = req.query;
  try {
    let query = `SELECT * FROM pitches`;
    let values: any[] = [];

    if (pitch_id) {
      query += ` WHERE login_id = $1`;
      values.push(pitch_id);
    }

    query += ` ORDER BY id DESC`;

    const result = await pool.query(query, values);
    res.status(200).json({ pitches: result.rows });
  } catch (err: any) {
    console.error("Error fetching pitches:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get Pitches for Current User (by pitch_id)
export const getPitchesForUser = async (req: Request, res: Response) => {
  const { pitch_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM warehouse WHERE login_id = $1 ORDER BY id DESC`,
      [pitch_id]
    );
    res.status(200).json({ pitches: result.rows });
  } catch (err: any) {
    console.error(`Error fetching pitches for pitch_id ${pitch_id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// Get Pitch by ID
export const getPitchById = async (req: Request, res: Response) => {
  const { pitch_id, id } = req.params;
  try {
    const result = await pool.query(
      `SELECT *
       FROM pitches
       WHERE login_id = $1 AND id = $2
       LIMIT 1`,
      [pitch_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pitch not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error fetching pitch by pitch_id & id:", err);
    res.status(500).json({ error: err.message });
  }
};

// Update Pitch
export const updatePitch = async (req: Request, res: Response) => {
  const { pitch_id, id } = req.body;

  const {
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
  } = req.body;

  try {
    // Check if pitch exists
    const existing = await pool.query(
      `SELECT * FROM pitches WHERE login_id = $1 AND id = $2`,
      [pitch_id, id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "You are not authorized to edit the pitch details.",
      });
    }

    // Update pitch
    const result = await pool.query(
      `UPDATE pitches
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
        pitch_id,
        id,
      ]
    );

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error updating pitch:", err);
    res.status(500).json({ error: err.message });
  }
};
