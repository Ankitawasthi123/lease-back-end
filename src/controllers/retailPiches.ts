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

    console.log("🧾 Received body:", req.body);

    const safeParse = (val: any) => {
      try {
        if (!val || val === "undefined" || val === "null") return {};
        if (typeof val === "object") return val;
        return JSON.parse(val);
      } catch {
        console.warn("⚠️ JSON parse failed for:", val);
        return {};
      }
    };

    const parsedDetails = safeParse(retail_details);
    const parsedCompliance = safeParse(retail_compliance);

    // Check for duplicate
    const existing = await pool.query(
      `SELECT id FROM retail_pitches WHERE retail_id = $1`,
      [retail_id]
    );

    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Retail pitch with this retail_id already exists" });
    }

    // Handle uploaded files
    const imageFiles = (req.files as any)?.images || [];
    const uploadedImages = imageFiles.map((file: Express.Multer.File) => ({
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/images/${file.filename}`,
    }));

    const pdfFile = (req.files as any)?.pdf_file?.[0];
    const pdfMeta = pdfFile
      ? {
          filename: pdfFile.filename,
          mimetype: pdfFile.mimetype,
          size: pdfFile.size,
          url: `/uploads/pdf/${pdfFile.filename}`,
        }
      : null;

    // Ensure retail_type is string
    const safeRetailType =
      typeof retail_type === "object"
        ? JSON.stringify(retail_type)
        : retail_type?.toString?.() || "";

    // Insert new pitch
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
        JSON.stringify(parsedDetails),
        JSON.stringify(parsedCompliance),
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
      retail_location,
      retail_size,
      retail_compliance,
      material_details,
      justification,
    } = req.body;

    const parsedCompliance = JSON.parse(retail_compliance || "{}");
    const parsedMaterial = JSON.parse(material_details || "{}");

    // Check existing
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

    // Handle image uploads
    const imageFiles = (req.files as any)?.images || [];
    const uploadedImages = imageFiles.length
      ? imageFiles.map((file: Express.Multer.File) => ({
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          url: `/uploads/images/${file.filename}`,
        }))
      : existingPitch.image_files;

    // Handle PDF uploads
    const pdfFile = (req.files as any)?.pdf_file?.[0];
    const pdfMeta = pdfFile
      ? {
          filename: pdfFile.filename,
          mimetype: pdfFile.mimetype,
          size: pdfFile.size,
          url: `/uploads/pdf/${pdfFile.filename}`,
        }
      : existingPitch.pdf_files;

    // Update retail pitch
    const result = await pool.query(
      `UPDATE retail_pitches
       SET retail_location = $1,
           retail_size = $2,
           retail_compliance = $3,
           material_details = $4,
           justification = $5,
           image_files = $6,
           pdf_files = $7
       WHERE login_id = $8 AND id = $9
       RETURNING *`,
      [
        retail_location,
        retail_size,
        JSON.stringify(parsedCompliance),
        JSON.stringify(parsedMaterial),
        justification || null,
        JSON.stringify(uploadedImages),
        JSON.stringify(pdfMeta),
        login_id,
        id,
      ]
    );

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error updating retail pitch:", err);
    res.status(500).json({ error: err.message });
  }
};
