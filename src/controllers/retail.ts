import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";

// ✅ CREATE Retail
export const createRetail = async (req: Request, res: Response) => {
  const {
    retail_details,
    retail_type,
    retail_compliance,
    login_id,
    status,
    company_details,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO retail (
        retail_details,
        retail_type,
        login_id,
        retail_compliance,
        status,
        company_details
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        retail_details,
        JSON.stringify(retail_type || []), // ✅ ensure JSON text
        login_id,
        JSON.stringify(retail_compliance || {}),
        status || "pending", // ✅ default value if not provided
        JSON.stringify(company_details || {}),
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET Retails for Current User
export const getRetailsCurrUser = async (req: Request, res: Response) => {
  const { login_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM retail WHERE login_id = $1 ORDER BY id DESC`,
      [login_id],
    );
    res.status(200).json({ retails: result.rows });
  } catch (err: any) {
    console.error(`Error fetching retails for login_id ${login_id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

export const getRetailById = async (req: Request, res: Response) => {
  const { login_id, id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Missing retail ID parameter" });
  }

  try {
    const retailResult = await pool.query(
      `SELECT * FROM retail WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (retailResult.rows.length === 0) {
      return res.status(404).json({ error: "Retail entry not found" });
    }

    const retail = retailResult.rows[0];

    const pitchesResult = await pool.query(
      `SELECT * FROM retail_pitches WHERE retail_id = $1`,
      [id],
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
  const { id, login_id, retail_details, retail_type, retail_compliance } =
    req.body;

  try {
    // ✅ Check if record exists and belongs to this user
    const existing = await pool.query(
      `SELECT * FROM retail WHERE login_id = $1 AND id = $2`,
      [login_id, id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "You are not authorized to edit this retail entry.",
      });
    }

    // ✅ Ensure retail_type is always an array
    const normalizedRetailType = Array.isArray(retail_type)
      ? retail_type
      : retail_type
        ? [retail_type]
        : [];

    // ✅ Update record
    const result = await pool.query(
      `UPDATE retail
       SET retail_details = $1,
           retail_type = $2,
           retail_compliance = $3
       WHERE login_id = $4 AND id = $5
       RETURNING *`,
      [
        retail_details || {}, // leave as object
        JSON.stringify(normalizedRetailType), // always JSON text
        retail_compliance || {}, // leave as object
        login_id,
        id,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(500).json({ error: "Failed to update retail entry." });
    }

    res.status(200).json(row);
  } catch (err: any) {
    console.error("Error updating retail entry:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ DELETE Retail (only when status is submitted & owned by user)
export const deleteRetail = async (req: Request, res: Response) => {
  const { retail_id, login_id } = req.params;
  if (!retail_id || !login_id) {
    return res.status(400).json({
      message: "retail_id and login_id are required",
    });
  }

  try {
    // 🔍 Step 1: Fetch retail record
    const retailResult = await pool.query(
      `
      SELECT id, status, login_id
      FROM retail
      WHERE id = $1
      `,
      [retail_id],
    );

    if (retailResult.rowCount === 0) {
      return res.status(404).json({ message: "Retail not found" });
    }

    const retail = retailResult.rows[0];

    // 🔒 Step 2: Ownership check
    if (String(retail.login_id) !== String(login_id)) {
      return res.status(403).json({
        message: "You are not allowed to delete this retail record",
      });
    }

    // 🚫 Step 3: Status check (safe)
    if (retail.status?.trim().toLowerCase() !== "submitted") {
      return res.status(400).json({
        message: "Retail can only be deleted when status is 'submitted'",
      });
    }

    // 🗑 Step 4: Delete
    const deleteResult = await pool.query(
      `
      DELETE FROM retail
      WHERE id = $1
      RETURNING *
      `,
      [retail_id],
    );

    return res.status(200).json({
      message: "Retail deleted successfully",
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    console.error("Delete Retail Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getRetailCompanyList = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (login_id)
        id AS retail_id,
        login_id AS company_id,
        company_details
      FROM retail
      WHERE login_id IS NOT NULL
      ORDER BY login_id ASC
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No retail companies found" });
    }

    // Return retail_id, company_id, company_details (so company_name can be extracted)
    res.status(200).json(
      result.rows.map((row) => ({
        retail_id: row.retail_id,
        company_id: row.company_id,
        company_name: row.company_details?.company_name || null,
      })),
    );
  } catch (err: any) {
    console.error("Error fetching retail company list:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ GET All Retails (filtered by company_id if provided)
export const getAllRetails = async (req: Request, res: Response) => {
  const { company_id } = req.query;

  try {
    let query = `SELECT * FROM retail`;
    const values: any[] = [];
    const conditions: string[] = [];

    // Filter by company_id if provided
    if (company_id) {
      values.push(company_id);
      conditions.push(`(company_details->>'id')::int = $${values.length}`);
    }

    // Add WHERE clause if needed
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY id DESC`;

    // Debug logs
    console.log("FINAL QUERY:", query);
    console.log("VALUES:", values);

    const result = await pool.query(query, values);
    res.status(200).json({ retails: result.rows });
  } catch (err: any) {
    console.error("Error fetching retails:", err);
    res.status(500).json({ error: err.message });
  }
};

