import { Request, Response } from "express";
import pool from "../config/db";

export const createRetailPitch = async (req: Request, res: Response) => {
  try {
    const {
      retail_id,
      login_id,
      retail_details,
      retail_compliance,
      property_type,
      justification,
      company_details,
      status,
    } = req.body;

    // -------------------------------
    // Safe JSON parse helper
    // -------------------------------
    const safeParse = (value: any) => {
      try {
        if (!value || value === "undefined" || value === "null") return {};
        if (typeof value === "object") return value;
        return JSON.parse(value);
      } catch {
        return {};
      }
    };

    const parsedRetailDetails = safeParse(retail_details);
    const parsedRetailCompliance = safeParse(retail_compliance);
    const parsedCompanyDetails = safeParse(company_details); // ✅ FIXED

    // -------------------------------
    // Validate Required Fields
    // -------------------------------
    if (!retail_id)
      return res.status(400).json({ error: "retail_id is required" });
    if (!login_id)
      return res.status(400).json({ error: "login_id is required" });
    if (!property_type)
      return res.status(400).json({ error: "property_type is required" });

    const safePropertyType =
      typeof property_type === "object"
        ? JSON.stringify(property_type)
        : property_type.toString();

    // -------------------------------
    // Duplicate check
    // -------------------------------
    const existing = await pool.query(
      `SELECT id FROM retail_pitches WHERE retail_id = $1 AND login_id = $2`,
      [retail_id, login_id],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: "A pitch for this retail_id and login_id already exists",
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
    // Insert into database
    // -------------------------------
    const result = await pool.query(
      `INSERT INTO retail_pitches (
        login_id,
        property_type,
        retail_details,
        retail_compliance,
        justification,
        image_files,
        pdf_files,
        retail_id,
        status,
        created_date,
        company_details
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        NOW(), $10
      )
      RETURNING *`,
      [
        login_id,
        safePropertyType,
        JSON.stringify(parsedRetailDetails),
        JSON.stringify(parsedRetailCompliance),
        justification || "",
        JSON.stringify(uploadedImages),
        JSON.stringify(pdfMeta),
        retail_id,
        status || "submitted",
        JSON.stringify(parsedCompanyDetails), // ✅ FIXED
      ],
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
 * ✅ GET Retail Pitch by Login ID and Retail ID
 */
export const getRetailPitchByLoginAndRetailId = async (
  req: Request,
  res: Response,
) => {
  const { login_id, retail_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM retail_pitches
       WHERE login_id = $1 AND retail_id = $2
       LIMIT 1`,
      [login_id, retail_id],
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
      property_type,
      retail_details,
      retail_compliance,
      justification,
      company_details,
    } = req.body;

    // -------------------------------
    // Safe JSON parse
    // -------------------------------
    const safeParse = (value: any) => {
      try {
        if (!value || value === "undefined" || value === "null") return {};
        if (typeof value === "object") return value;
        return JSON.parse(value);
      } catch {
        return {};
      }
    };

    const parsedDetails = safeParse(retail_details);
    const parsedCompliance = safeParse(retail_compliance);
    const parsedCompanyDetails = safeParse(company_details);

    // -------------------------------
    // Authorization check
    // -------------------------------
    const existing = await pool.query(
      `SELECT id FROM retail_pitches WHERE login_id = $1 AND id = $2`,
      [login_id, id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "You are not authorized to edit this retail pitch.",
      });
    }

    const existingPitch = (
      await pool.query(`SELECT * FROM retail_pitches WHERE id = $1`, [id])
    ).rows[0];

    /* --------------------------- IMAGES ----------------------------- */

    const existingImages = existingPitch.image_files || [];
    const newUploadedImages = (req.files as any)?.images || [];

    const formattedNewImages = newUploadedImages.map(
      (file: Express.Multer.File) => ({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/images/${file.filename}`,
      }),
    );

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
         SET property_type = $1,
             retail_details = $2,
             retail_compliance = $3,
             justification = $4,
             image_files = $5,
             pdf_files = $6,
             company_details = $7
       WHERE login_id = $8 AND id = $9
       RETURNING *`,
      [
        property_type,
        JSON.stringify(parsedDetails),
        JSON.stringify(parsedCompliance),
        justification || null,
        JSON.stringify(finalImages),
        JSON.stringify(finalPdf),
        JSON.stringify(parsedCompanyDetails),
        login_id,
        id,
      ],
    );

    return res.status(200).json(updated.rows[0]);
  } catch (err: any) {
    console.error("Error updating retail pitch:", err);
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
      [pitch_id],
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

export const getRetailPitchCompanyList = async (
  req: Request,
  res: Response,
) => {
  try {
    const { login_id } = req.body;

    // Validate login_id
    if (!login_id || isNaN(Number(login_id))) {
      return res
        .status(400)
        .json({ message: "login_id must be a valid number" });
    }

    const loginIdNum = Number(login_id);

    const result = await pool.query(
      `
      SELECT DISTINCT ON ((r.company_details->>'id'))
        rp.id AS pitch_id,
        rp.retail_id,
        rp.login_id,
        r.company_details
      FROM retail_pitches rp
      LEFT JOIN retail r
        ON rp.retail_id = r.id
      WHERE rp.login_id = $1
      ORDER BY (r.company_details->>'id'), rp.id DESC
      `,
      [loginIdNum],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No retail pitches found for this user" });
    }

    const formattedRows = result.rows.map((row: any) => {
      const company = row.company_details || {};
      return {
        pitch_id: row.pitch_id,
        retail_id: row.retail_id,
        login_id: row.login_id,
        company_id: company.id || null,
        company_name: company.company_name || null,
      };
    });

    res.status(200).json(formattedRows);
  } catch (err) {
    console.error("Error fetching retail pitch company list:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * ✅ GET Retail Pitch by ID
 */
export const getRetailPitchesForUser = async (req: Request, res: Response) => {
  const { login_id, company_id } = req.query;

  if (!login_id || isNaN(Number(login_id))) {
    return res.status(400).json({ message: "login_id must be a valid number" });
  }

  if (!company_id || isNaN(Number(company_id))) {
    return res
      .status(400)
      .json({ message: "company_id must be a valid number" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        rp.id AS pitch_id,
        rp.retail_id,
        rp.login_id,
        rp.retail_details,
        rp.retail_compliance,
        rp.created_date,
        r.company_details,
        rp.property_type,
        rp.status 
      FROM retail_pitches rp
      INNER JOIN retail r
        ON rp.retail_id = r.id
      WHERE rp.login_id = $1
        AND (r.company_details->>'id')::int = $2
      ORDER BY rp.id DESC
      `,
      [Number(login_id), Number(company_id)],
    );

    res.status(200).json(result.rows);
  } catch (err: any) {
    console.error("Error fetching retail pitches:", err);
    res.status(500).json({ error: err.message });
  }
};
