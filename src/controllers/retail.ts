import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";

// ✅ CREATE Retail
export const createRetail = async (req: Request, res: Response) => {
  const { retail_details, retail_type, retail_compliance, login_id } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO retail (
        retail_details,
        retail_type,
        login_id,
        retail_compliance
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        retail_details,
        retail_type,
        login_id,
        JSON.stringify(retail_compliance || {}),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET All Retails (optionally by login_id)
export const getAllRetails = async (req: Request, res: Response) => {
  const { login_id } = req.query;
  try {
    let query = `SELECT * FROM retail`;
    let values: any[] = [];

    if (login_id) {
      query += ` WHERE login_id = $1`;
      values.push(login_id);
    }

    query += ` ORDER BY id DESC`;

    const result = await pool.query(query, values);
    res.status(200).json({ retails: result.rows });
  } catch (err: any) {
    console.error("Error fetching retails:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET Retails for Current User
export const getRetailsCurrUser = async (req: Request, res: Response) => {
  const { login_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM retail WHERE login_id = $1 ORDER BY id DESC`,
      [login_id]
    );
    res.status(200).json({ retails: result.rows });
  } catch (err: any) {
    console.error(`Error fetching retails for login_id ${login_id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

export const getRetailById = async (req: Request, res: Response) => {
  const { login_id, id } = req.params;
  console.log("==============================================", login_id, id)
  console.log("Params:", req.params);

  if (!id) {
    return res.status(400).json({ error: "Missing retail ID parameter" });
  }

  try {
    const retailResult = await pool.query(
      `SELECT * FROM retail WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (retailResult.rows.length === 0) {
      return res.status(404).json({ error: "Retail entry not found" });
    }

    const retail = retailResult.rows[0];

    const pitchesResult = await pool.query(
      `SELECT * FROM pitches WHERE id = $1`,
      [id]
    );

    if (pitchesResult.rows.length > 0) {
      return res.status(200).json({
        ...retail,
        pitches: retail?.login_id === login_id ? pitchesResult.rows : [],
      });
    }

    return res.status(200).json(retail);
  } catch (err: any) {
    console.error("Error fetching retail and pitches:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ UPDATE Retail
export const updateRetail = async (req: Request, res: Response) => {
  const { login_id, id } = req.body;
  const { retail_location, retail_size, retail_compliance, material_details } =
    req.body;

  try {
    const existing = await pool.query(
      `SELECT * FROM retail WHERE login_id = $1 AND id = $2`,
      [login_id, id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "You are not authorized to edit the retail entry.",
      });
    }

    const result = await pool.query(
      `UPDATE retail
       SET retail_location = $1,
           retail_size = $2,
           retail_compliance = $3,
           material_details = $4
       WHERE login_id = $5 AND id = $6
       RETURNING *`,
      [
        retail_location,
        retail_size,
        JSON.stringify(retail_compliance || {}),
        JSON.stringify(material_details || {}),
        login_id,
        id,
      ]
    );

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error updating retail entry:", err);
    res.status(500).json({ error: err.message });
  }
};
