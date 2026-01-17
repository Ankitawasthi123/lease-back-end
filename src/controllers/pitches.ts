import { Request, Response } from "express";
import pool from "../config/db";

// ---------- CREATE PITCH ----------
export const createPitch = async (req: Request, res: Response) => {
  try {
    const {
      warehouse_id,
      login_id,
      warehouse_location,
      warehouse_size,
      warehouse_compliance,
      material_details,
      justification,
      rate_details,
    } = req.body;

    const safeParse = (val: any, fallback: any = {}) => {
      if (!val) return fallback;
      if (typeof val === "object") return val;
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    };

    const parsedCompliance = safeParse(warehouse_compliance);
    const parsedMaterial = safeParse(material_details);

    const files: any = req.files || {};

    const imageFiles = Array.isArray(files.images) ? files.images : [];
    const uploadedImages = imageFiles.map((file: Express.Multer.File) => ({
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/images/${file.filename}`,
    }));

    const pdfFile = files.pdf_file?.[0];
    const pdfMeta = pdfFile
      ? {
          filename: pdfFile.filename,
          mimetype: pdfFile.mimetype,
          size: pdfFile.size,
          url: `/uploads/pdf/${pdfFile.filename}`,
        }
      : null;

    const result = await pool.query(
      `INSERT INTO pitches (
        warehouse_location,
        warehouse_id,
        login_id,
        warehouse_size,
        warehouse_compliance,
        material_details,
        justification,
        image_files,
        pdf_files,
        rate_details,
        created_at,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING *`,
      [
        warehouse_location ?? null,
        Number(warehouse_id),
        Number(login_id),
        warehouse_size ?? null,
        JSON.stringify(parsedCompliance),
        JSON.stringify(parsedMaterial),
        justification ?? "",
        JSON.stringify(uploadedImages),
        JSON.stringify(pdfMeta),
        rate_details,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Pitch created successfully",
      data: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ Create pitch error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create pitch",
      error: err.message,
    });
  }
};

// ---------- GET ALL PITCHES ----------
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

// ---------- GET PITCH BY ID ----------
export const getPitchById = async (req: Request, res: Response) => {
  const { pitch_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM pitches WHERE id = $1 LIMIT 1`,
      [pitch_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pitch not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error fetching pitch by ID:", err);
    res.status(500).json({ error: err.message });
  }
};

// ---------- GET PITCH BY LOGIN AND WAREHOUSE ID ----------
export const getPitchByLoginAndWarehouseId = async (req: Request, res: Response) => {
  const { login_id, warehouse_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM pitches WHERE login_id = $1 AND warehouse_id = $2 LIMIT 1`,
      [login_id, warehouse_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pitch not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error fetching pitch by login_id & warehouse_id:", err);
    res.status(500).json({ error: err.message });
  }
};

// ---------- UPDATE PITCH ----------
export const updatePitch = async (req: Request, res: Response) => {
  try {
    const {
      id,
      login_id,
      warehouse_id,
      warehouse_location,
      warehouse_size,
      warehouse_compliance,
      material_details,
      justification,
      rate_details,
    } = req.body;

    const safeParse = (val: any) => {
      if (!val) return null;
      if (typeof val === "object") return val;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    };

    const parsedLocation = safeParse(warehouse_location);
    const parsedCompliance = safeParse(warehouse_compliance) || {};
    const parsedMaterial = safeParse(material_details) || {};

    const authCheck = await pool.query(
      `SELECT image_files, pdf_files FROM pitches WHERE id = $1 AND login_id = $2 AND warehouse_id = $3`,
      [Number(id), Number(login_id), Number(warehouse_id)]
    );

    if (authCheck.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized pitch update",
      });
    }

    const existingPitch = authCheck.rows[0];

    const files: any = req.files || {};

    const imageFiles = Array.isArray(files.images) ? files.images : [];
    const uploadedImages =
      imageFiles.length > 0
        ? imageFiles.map((file: Express.Multer.File) => ({
            filename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
            url: `/uploads/images/${file.filename}`,
          }))
        : existingPitch.image_files || [];

    const pdfFile = files.pdf_file?.[0];
    const pdfMeta = pdfFile
      ? {
          filename: pdfFile.filename,
          mimetype: pdfFile.mimetype,
          size: pdfFile.size,
          url: `/uploads/pdf/${pdfFile.filename}`,
        }
      : existingPitch.pdf_files;

    const result = await pool.query(
      `UPDATE pitches
       SET warehouse_location   = $1,
           warehouse_size       = $2,
           warehouse_compliance = $3,
           material_details     = $4,
           justification        = $5,
           image_files          = $6,
           pdf_files            = $7,
           rate_details         = $8,
           updated_at           = NOW()
       WHERE id = $9 AND login_id = $10 AND warehouse_id = $11
       RETURNING *`,
      [
        JSON.stringify(parsedLocation),
        warehouse_size,
        JSON.stringify(parsedCompliance),
        JSON.stringify(parsedMaterial),
        justification ?? null,
        JSON.stringify(uploadedImages),
        JSON.stringify(pdfMeta),
        rate_details,
        Number(id),
        Number(login_id),
        Number(warehouse_id),
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Pitch updated successfully",
      data: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ Update pitch error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update pitch",
    });
  }
};

// ---------- GET PITCHES FOR USER WITH COMPANY FILTER ----------
export const getPitchesForUser = async (req: Request, res: Response) => {
  try {
    const { login_id, company_id } = req.body;

    if (!login_id || isNaN(Number(login_id))) {
      return res.status(400).json({ message: "login_id must be a valid number" });
    }

    const loginIdNum = Number(login_id);
    const companyIdNum = company_id ? Number(company_id) : null;

    // Get pitches for this user
    const result = await pool.query(
      `
      SELECT 
        p.*,
        w.company_details
      FROM pitches p
      LEFT JOIN warehouse w
        ON w.id = p.warehouse_id
      WHERE p.login_id = $1
      ${companyIdNum ? `AND (w.company_details->>'id')::int = $2` : ''}
      ORDER BY p.id DESC
      `,
      companyIdNum ? [loginIdNum, companyIdNum] : [loginIdNum]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No pitches found for this user" });
    }

    // Map response to include company_id and company_name for frontend
    const formattedRows = result.rows.map((row: any) => {
      const company = row.company_details || {};
      return {
        ...row,
        company_id: company.id || null,
        company_name: company.company_name || null,
      };
    });

    res.status(200).json({ pitches: formattedRows });
  } catch (err) {
    console.error("Error fetching pitches for user:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getWarehouseRequirementCompanyList = async (req: Request, res: Response) => {
  try {
    const { login_id } = req.body;

    if (!login_id || isNaN(Number(login_id))) {
      return res.status(400).json({ message: "login_id must be a valid number" });
    }

    const loginIdNum = Number(login_id);

    // Get distinct warehouses for this user
    const result = await pool.query(
      `
      SELECT DISTINCT ON (p.warehouse_id)
        p.warehouse_id,
        w.company_details
      FROM pitches p
      LEFT JOIN warehouse w
        ON w.id = p.warehouse_id
      WHERE p.login_id = $1
      ORDER BY p.warehouse_id, w.company_details->>'company_name' ASC NULLS LAST
      `,
      [loginIdNum]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No warehouses found for this user" });
    }

    // Map to only warehouse_id, company_name, and company id
    const formattedRows = result.rows.map((row: any) => {
      const company = row.company_details || {};
      return {
        warehouse_id: row.warehouse_id,
        company_id: company.id || null,
        company_name: company.company_name || null,
      };
    });

    res.status(200).json(formattedRows);
  } catch (err) {
    console.error("Error fetching warehouse company list:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


