import { Request, Response } from "express";
import pool from "../config/db";

export const createRetailPitch = async (req: Request, res: Response) => {
  try {

    const {
      retail_id,
      login_id,
      retail_details,
      retail_compliance,
      retail_type,
      justification,
    } = req.body;

    // -------------------------------
    // Helper: Safe JSON parse
    // -------------------------------
    const safeParse = (value: any) => {
      try {
        if (!value || value === "undefined" || value === "null") return {};
        if (typeof value === "object") return value; // already parsed
        return JSON.parse(value);
      } catch (err) {
        console.warn("⚠️ JSON parse failed for:", value);
        return {};
      }
    };

    // -------------------------------
    // Parse JSON Fields
    // -------------------------------
    const parsedRetailDetails = safeParse(retail_details);
    const parsedRetailCompliance = safeParse(retail_compliance);

    // -------------------------------
    // Validate Required Fields
    // -------------------------------
    if (!retail_id) {
      return res.status(400).json({ error: "retail_id is required" });
    }

    if (!login_id) {
      return res.status(400).json({ error: "login_id is required" });
    }

    if (!retail_type) {
      return res.status(400).json({ error: "retail_type is required" });
    }

    // Convert retail_type to string safely
    const safeRetailType =
      typeof retail_type === "object"
        ? JSON.stringify(retail_type)
        : retail_type.toString();

    // -------------------------------
    // Duplicate retail_id Check
    // -------------------------------
    const existing = await pool.query(
      `SELECT id FROM retail_pitches WHERE retail_id = $1`,
      [retail_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: "Retail pitch with this retail_id already exists",
      });
    }

    // -------------------------------
    // Handle File Uploads
    // -------------------------------
    const imageFiles = (req.files as any)?.images || [];
    const uploadedImages = imageFiles.map((file: Express.Multer.File) => ({
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/images/${file.filename}`,
    }));

    const pdfFile = (req.files as any)?.pdf_file?.[0] || null;
    const pdfMeta = pdfFile
      ? {
          filename: pdfFile.filename,
          mimetype: pdfFile.mimetype,
          size: pdfFile.size,
          url: `/uploads/pdf/${pdfFile.filename}`,
        }
      : null;

    // -------------------------------
    // Save to Database
    // -------------------------------
    const result = await pool.query(
      `INSERT INTO retail_pitches (
        login_id,
        retail_type,
        retail_details,
        retail_compliance,
        justification,
        image_files,
        pdf_files,
        retail_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        login_id,
        safeRetailType,
        JSON.stringify(parsedRetailDetails),
        JSON.stringify(parsedRetailCompliance),
        justification || "",
        JSON.stringify(uploadedImages),
        JSON.stringify(pdfMeta),
        retail_id,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error("❌ Error creating retail pitch:", err);
    return res.status(500).json({ error: err.message });
  }
};


/**
 * ✅ GET All Retail Pitches (optionally by login_id)
 */
export const getAllRetailPitches = async (req: Request, res: Response) => {
  const { login_id } = req.query;
  try {
    let query = `SELECT * FROM retail_pitches`;
    const values: any[] = [];

    if (login_id) {
      query += ` WHERE login_id = $1`;
      values.push(login_id);
    }

    query += ` ORDER BY id DESC`;

    const result = await pool.query(query, values);
    res.status(200).json({ retail_pitches: result.rows });
  } catch (err: any) {
    console.error("Error fetching retail pitches:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ GET Retail Pitches for a Specific User
 */
export const getRetailPitchesForUser = async (req: Request, res: Response) => {
  const { login_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM retail_pitches WHERE login_id = $1 ORDER BY id DESC`,
      [login_id]
    );
    res.status(200).json({ retail_pitches: result.rows });
  } catch (err: any) {
    console.error(`Error fetching retail pitches for user ${login_id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ GET Retail Pitch by ID
 */
export const getRetailPitchById = async (req: Request, res: Response) => {
  const { pitch_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM retail_pitches WHERE id = $1 LIMIT 1`,
      [pitch_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Retail pitch not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error fetching retail pitch by ID:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ GET Retail Pitch by Login ID and Retail ID
 */
export const getRetailPitchByLoginAndRetailId = async (req: Request, res: Response) => {
  const { login_id, retail_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM retail_pitches
       WHERE login_id = $1 AND retail_id = $2
       LIMIT 1`,
      [login_id, retail_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Retail pitch not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error fetching retail pitch by login_id & retail_id:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ UPDATE Retail Pitch
 */
export const updateRetailPitch = async (req: Request, res: Response) => {
  try {
    const {
      id,
      login_id,
      retail_type,
      retail_details,
      retail_compliance,
      justification,
    } = req.body;

    // Parse JSON fields
    const parsedDetails = JSON.parse(retail_details || "{}");
    const parsedCompliance = JSON.parse(retail_compliance || "{}");

    // Fetch existing pitch
    const existing = await pool.query(
      `SELECT * FROM retail_pitches WHERE login_id = $1 AND id = $2`,
      [login_id, id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "You are not authorized to edit this retail pitch.",
      });
    }

    const existingPitch = existing.rows[0];

    /* --------------------------- IMAGES ----------------------------- */

    const existingImages = existingPitch.image_files || [];
    const newUploadedImages = (req.files as any)?.images || [];

    const formattedNewImages = newUploadedImages.map(
      (file: Express.Multer.File) => ({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/images/${file.filename}`,
      })
    );

    // Keep all old images + add new ones
    const finalImages = [...existingImages, ...formattedNewImages];

    /* ----------------------------- PDF ------------------------------ */

    const newPdfFile = (req.files as any)?.pdf_file?.[0];

    const finalPdf = newPdfFile
      ? {
          filename: newPdfFile.filename,
          mimetype: newPdfFile.mimetype,
          size: newPdfFile.size,
          url: `/uploads/pdf/${newPdfFile.filename}`,
        }
      : existingPitch.pdf_files;

    /* --------------------------- UPDATE ----------------------------- */

    const updated = await pool.query(
      `UPDATE retail_pitches
         SET retail_type = $1,
             retail_details = $2,
             retail_compliance = $3,
             justification = $4,
             image_files = $5,
             pdf_files = $6
       WHERE login_id = $7 AND id = $8
       RETURNING *`,
      [
        retail_type,
        JSON.stringify(parsedDetails),
        JSON.stringify(parsedCompliance),
        justification || null,
        JSON.stringify(finalImages),
        JSON.stringify(finalPdf),
        login_id,
        id,
      ]
    );

    return res.status(200).json(updated.rows[0]);
  } catch (err: any) {
    console.error("Error updating retail pitch:", err);
    res.status(500).json({ error: err.message });
  }
};


