import { Request, Response } from "express";
import pool from "../config/db";

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

    // Parse JSON strings if necessary (from form-data)
    const parsedCompliance = JSON.parse(warehouse_compliance || "{}");
    const parsedMaterial = JSON.parse(material_details || "{}");

    // Uploaded image files
    const imageFiles = (req.files as any)?.images || [];
    const uploadedImages = imageFiles.map((file: Express.Multer.File) => ({
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/images/${file.filename}`,
    }));

    // Uploaded PDF file
    const pdfFile = (req.files as any)?.pdf_file?.[0];
    const pdfMeta = pdfFile
      ? {
          filename: pdfFile.filename,
          mimetype: pdfFile.mimetype,
          size: pdfFile.size,
          url: `/uploads/pdf/${pdfFile.filename}`,
        }
      : null;

    // Insert into DB
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        warehouse_location,
        warehouse_id,
        login_id,
        warehouse_size,
        JSON.stringify(parsedCompliance),
        JSON.stringify(parsedMaterial),
        justification || "",
        JSON.stringify(uploadedImages),
        JSON.stringify(rate_details),
        JSON.stringify(pdfMeta),
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
  const { pitch_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT *
       FROM pitches
       WHERE id = $1
       LIMIT 1`,
      [pitch_id]
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

export const getPitchByLoginAndWarehouseId = async (req: Request, res: Response) => {
  const { login_id, warehouse_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT *
       FROM pitches
       WHERE login_id = $1 AND warehouse_id = $2
       LIMIT 1`,
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

    // ---------- SAFE JSON PARSER ----------
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

    // ---------- AUTH CHECK ----------
    const authCheck = await pool.query(
      `SELECT image_files, pdf_files 
       FROM pitches 
       WHERE id = $1 AND login_id = $2 AND warehouse_id = $3`,
      [Number(id), Number(login_id), Number(warehouse_id)]
    );

    if (authCheck.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized pitch update",
      });
    }

    const existingPitch = authCheck.rows[0];

    // ---------- FILE HANDLING ----------
    const files: any = req.files || {};

    const imageFiles = Array.isArray(files.images)
      ? files.images
      : [];

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

    // ---------- UPDATE ----------
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

    // ---------- SUCCESS ----------
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




