import { Request, Response } from "express";
import { Retail, RetailPitch } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";
import { Op } from "sequelize";

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

    // Validate Required Fields
    if (!retail_id) {
      return sendErrorResponse(res, 400, "retail_id is required");
    }
    if (!login_id) {
      return sendErrorResponse(res, 400, "login_id is required");
    }
    if (!property_type) {
      return sendErrorResponse(res, 400, "property_type is required");
    }

    // Safe JSON parse helper
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
    const parsedCompanyDetails = safeParse(company_details);

    const safePropertyType =
      typeof property_type === "object"
        ? JSON.stringify(property_type)
        : property_type.toString();

    // Duplicate check
    const existing = await RetailPitch.findOne({
      where: { retail_id: Number(retail_id), login_id: Number(login_id) },
    });

    if (existing) {
      return sendErrorResponse(res, 409, "A pitch for this retail already exists");
    }

    // Handle File Uploads
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

    // Create retail pitch
    const pitch = await RetailPitch.create({
      login_id: Number(login_id),
      property_type: safePropertyType,
      retail_details: parsedRetailDetails,
      retail_compliance: parsedRetailCompliance,
      justification: justification || "",
      image_files: uploadedImages,
      pdf_files: pdfMeta,
      retail_id: Number(retail_id),
      status: status || "submitted",
      company_details: parsedCompanyDetails,
    });

    return res.status(201).json({
      success: true,
      message: "Retail pitch created successfully",
      data: pitch.toJSON(),
    });
  } catch (err: any) {
    console.error("❌ Error creating retail pitch:", err.message);
    return sendErrorResponse(res, 500, "Failed to create retail pitch", err);
  }
};

/**
 * ✅ GET All Retail Pitches (optionally by login_id)
 */
export const getAllRetailPitches = async (req: Request, res: Response) => {
  const { login_id } = req.query;
  try {
    let where: any = {};

    if (login_id) {
      where.login_id = Number(login_id);
    }

    const pitches = await RetailPitch.findAll({
      where,
      order: [["id", "DESC"]],
    });

    res.status(200).json({ 
      success: true,
      retail_pitches: pitches.map(p => p.toJSON()) 
    });
  } catch (err: any) {
    console.error("Error fetching retail pitches:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch retail pitches", err);
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

  if (!login_id || !retail_id) {
    return sendErrorResponse(res, 400, "login_id and retail_id are required");
  }

  try {
    const pitch = await RetailPitch.findOne({
      where: {
        login_id: Number(login_id),
        retail_id: Number(retail_id),
      },
    });

    if (!pitch) {
      return sendErrorResponse(res, 404, "Retail pitch not found");
    }

    res.status(200).json({ success: true, data: pitch.toJSON() });
  } catch (err: any) {
    console.error("Error fetching retail pitch by login_id & retail_id:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch retail pitch", err);
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

    if (!id || !login_id) {
      return sendErrorResponse(res, 400, "id and login_id are required");
    }

    // Safe JSON parse
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

    // Authorization check
    const pitch = await RetailPitch.findOne({
      where: { login_id: Number(login_id), id: Number(id) },
    });

    if (!pitch) {
      return sendErrorResponse(res, 403, "You do not have permission to edit this pitch");
    }

    // Handle new images
    const existingImages = pitch.image_files || [];
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

    // Handle PDF
    const newPdfFile = (req.files as any)?.pdf_file?.[0];

    const finalPdf = newPdfFile
      ? {
          filename: newPdfFile.filename,
          mimetype: newPdfFile.mimetype,
          size: newPdfFile.size,
          url: `/uploads/pdf/${newPdfFile.filename}`,
        }
      : pitch.pdf_files;

    // Update
    await pitch.update({
      property_type: property_type || pitch.property_type,
      retail_details: parsedDetails,
      retail_compliance: parsedCompliance,
      justification: justification || pitch.justification,
      image_files: finalImages,
      pdf_files: finalPdf,
      company_details: parsedCompanyDetails,
    });

    return res.status(200).json({
      success: true,
      message: "Retail pitch updated successfully",
      data: pitch.toJSON(),
    });
  } catch (err: any) {
    console.error("Error updating retail pitch:", err.message);
    return sendErrorResponse(res, 500, "Failed to update retail pitch", err);
  }
};

/**
 * ✅ GET Retail Pitch by ID
 */
export const getRetailPitchById = async (req: Request, res: Response) => {
  const { pitch_id } = req.params;
  try {
    if (!pitch_id) {
      return sendErrorResponse(res, 400, "Pitch ID is required");
    }

    const pitch = await RetailPitch.findByPk(Number(pitch_id));

    if (!pitch) {
      return sendErrorResponse(res, 404, "Retail pitch not found");
    }

    res.status(200).json({ success: true, data: pitch.toJSON() });
  } catch (err: any) {
    console.error("Error fetching retail pitch by ID:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch retail pitch", err);
  }
};

export const getRetailPitchCompanyList = async (
  req: Request,
  res: Response,
) => {
  try {
    const { login_id } = req.body;

    if (!login_id || isNaN(Number(login_id))) {
      return sendErrorResponse(res, 400, "login_id must be a valid number");
    }

    const loginIdNum = Number(login_id);

    const pitches = await RetailPitch.findAll({
      where: { login_id: loginIdNum }, // ✅ NOW MATCHES DB TYPE
      include: [
        {
          model: Retail,
          attributes: ["company_details"],
          required: false,
        },
      ],
      order: [["id", "DESC"]],
      raw: true,
      subQuery: false,
    });

    if (!pitches.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const uniqueCompanies = new Map<string, any>();

    pitches.forEach((row: any) => {
      const company = row["retail.company_details"];

      if (company?.id) {
        const key = String(company.id);
        if (!uniqueCompanies.has(key)) {
          uniqueCompanies.set(key, {
            pitch_id: row.id,
            retail_id: row.retail_id,
            login_id: row.login_id,
            company_id: company.id,
            company_name: company.company_name || null,
          });
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: Array.from(uniqueCompanies.values()),
    });
  } catch (err: any) {
    console.error("Error fetching retail pitch company list:", err);
    return sendErrorResponse(res, 500, "Failed to fetch company list", err.message);
  }
};


/**
 * ✅ GET Retail Pitches for User (filtered by company)
 */
export const getRetailPitchesForUser = async (req: Request, res: Response) => {
  const { login_id, company_id } = req.query;

  if (!login_id || isNaN(Number(login_id))) {
    return sendErrorResponse(res, 400, "login_id must be a valid number");
  }

  if (!company_id || isNaN(Number(company_id))) {
    return sendErrorResponse(res, 400, "company_id must be a valid number");
  }

  try {
    const pitches = await RetailPitch.findAll({
      where: { login_id: Number(login_id) },
      include: [{
        model: Retail,
        attributes: ['company_details'],
        required: true,
      }],
      raw: true,
      order: [["id", "DESC"]],
    });

    // Filter by company_id
    const filteredPitches = pitches
      .filter((p: any) => {
        const company = p["retail.company_details"] || {};
        return Number(company.id) === Number(company_id);
      })
      .map((p: any) => ({
        pitch_id: p.id,
        retail_id: p.retail_id,
        login_id: p.login_id,
        company_id: p["retail.company_details"]?.id,
      }));

    res.status(200).json({ success: true, data: filteredPitches });
  } catch (err: any) {
    console.error("Error fetching retail pitches for user:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch pitches", err);
  }
};
