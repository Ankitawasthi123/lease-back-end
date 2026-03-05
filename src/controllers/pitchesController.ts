import { Request, Response } from "express";
import { Pitch, Warehouse } from "../models";
import fs from "fs";
import path from "path";

/**
 * Helper: Send error response with proper status codes
 */
const sendErrorResponse = (res: Response, statusCode: number, message: string, error?: any) => {
  const isDev = process.env.NODE_ENV === "development";
  const response: any = {
    success: false,
    status: statusCode,
    message,
  };
  
  if (isDev && error) {
    response.details = error.message || String(error);
  }
  
  return res.status(statusCode).json(response);
};

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
      status,
      pitcher_details,
    } = req.body;

    // Validate required fields
    if (!warehouse_id || !login_id) {
      return sendErrorResponse(res, 400, "warehouse_id and login_id are required");
    }

    const warehouseIdNum = Number(warehouse_id);
    const loginIdNum = Number(login_id);

    if (!Number.isFinite(warehouseIdNum) || !Number.isFinite(loginIdNum)) {
      return sendErrorResponse(res, 400, "warehouse_id and login_id must be valid numbers");
    }

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

    const pitch = await Pitch.create({
      warehouse_id: warehouseIdNum,
      login_id: loginIdNum,
      warehouse_location: warehouse_location ?? null,
      warehouse_size: warehouse_size ?? null,
      warehouse_compliance: parsedCompliance,
      material_details: parsedMaterial,
      justification: justification ?? "",
      image_files: uploadedImages,
      pdf_files: pdfMeta,
      rate_details: rate_details,
      status: status ?? "submitted",
      pitcher_details: pitcher_details,
    });

    return res.status(201).json({
      success: true,
      message: "Pitch created successfully",
      data: pitch.toJSON(),
    });
  } catch (err: any) {
    console.error("❌ Create pitch error:", err.message);
    return sendErrorResponse(res, 500, "Failed to create pitch", err);
  }
};

// ---------- GET ALL PITCHES ----------
export const getAllPitches = async (req: Request, res: Response) => {
  const { pitch_id } = req.query;
  try {
    const where: any = {};
    
    if (pitch_id) {
      where.login_id = Number(pitch_id);
    }

    const pitches = await Pitch.findAll({
      where,
      order: [["id", "DESC"]],
    });

    res.status(200).json({ 
      success: true,
      pitches: pitches.map(p => p.toJSON()) 
    });
  } catch (err: any) {
    console.error("Error fetching pitches:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch pitches", err);
  }
};

// ---------- GET PITCH BY ID ----------
export const getPitchById = async (req: Request, res: Response) => {
  const { pitch_id } = req.params;
  try {
    if (!pitch_id) {
      return sendErrorResponse(res, 400, "Pitch ID is required");
    }

    const pitch = await Pitch.findByPk(Number(pitch_id));

    if (!pitch) {
      return sendErrorResponse(res, 404, "Pitch not found");
    }

    res.status(200).json({ success: true, data: pitch.toJSON() });
  } catch (err: any) {
    console.error("Error fetching pitch by ID:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch pitch", err);
  }
};

// ---------- GET PITCH BY LOGIN AND WAREHOUSE ID ----------
export const getPitchByLoginAndWarehouseId = async (
  req: Request,
  res: Response,
) => {
  const { login_id, warehouse_id } = req.params;

  try {
    if (!login_id || !warehouse_id) {
      return sendErrorResponse(res, 400, "login_id and warehouse_id are required");
    }

    const pitch = await Pitch.findOne({
      where: {
        login_id: Number(login_id),
        warehouse_id: Number(warehouse_id),
      },
    });

    if (!pitch) {
      return sendErrorResponse(res, 404, "Pitch not found");
    }

    res.status(200).json({ success: true, data: pitch.toJSON() });
  } catch (err: any) {
    console.error("Error fetching pitch by login_id & warehouse_id:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch pitch", err);
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
      status,
    } = req.body;

    if (!id || !login_id) {
      return sendErrorResponse(res, 400, "id and login_id are required");
    }

    const pitchIdNum = Number(id);
    const loginIdNum = Number(login_id);
    const warehouseIdNum = Number(warehouse_id);

    if (!Number.isFinite(pitchIdNum) || !Number.isFinite(loginIdNum)) {
      return sendErrorResponse(res, 400, "id and login_id must be valid numbers");
    }

    if (warehouse_id !== undefined && warehouse_id !== null && warehouse_id !== "" && !Number.isFinite(warehouseIdNum)) {
      return sendErrorResponse(res, 400, "warehouse_id must be a valid number");
    }

    const safeParse = (val: any) => {
      if (!val) return null;
      if (typeof val === "object") return val;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    };

    // Check authorization
    const pitch = await Pitch.findOne({
      where: {
        id: pitchIdNum,
        login_id: loginIdNum,
        ...(warehouse_id !== undefined && warehouse_id !== null && warehouse_id !== ""
          ? { warehouse_id: warehouseIdNum }
          : {}),
      },
    });

    if (!pitch) {
      return sendErrorResponse(res, 403, "You do not have permission to update this pitch");
    }

    const files: any = req.files || {};
    const imageFiles = Array.isArray(files.images) ? files.images : [];
    const formattedNewImages = imageFiles.map((file: Express.Multer.File) => ({
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/images/${file.filename}`,
    }));

    const existingImages = Array.isArray(pitch.image_files)
      ? pitch.image_files
      : [];

    const parseImageArray = (value: any): any[] | null => {
      if (value === undefined || value === null) {
        return null;
      }

      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value === "string") {
        if (!value.trim()) {
          return null;
        }

        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }

      return null;
    };

    const resolveImageFileName = (image: any): string | null => {
      if (!image) {
        return null;
      }

      if (typeof image === "string") {
        return path.basename(image);
      }

      const candidate = image.filename || image.name || image.url;
      if (!candidate || typeof candidate !== "string") {
        return null;
      }

      return path.basename(candidate);
    };

    const retainedImagesInput =
      req.body.image_files ??
      req.body.retained_images ??
      req.body.existing_images;

    const retainedImages = parseImageArray(retainedImagesInput);
    if (retainedImagesInput !== undefined && retainedImages === null) {
      return sendErrorResponse(res, 400, "image_files must be a valid JSON array");
    }

    const keepFileNames = new Set(
      (retainedImages || [])
        .map((image: any) => resolveImageFileName(image))
        .filter(Boolean),
    );

    const retainedExistingImages =
      retainedImages === null
        ? existingImages
        : existingImages.filter((image: any) => keepFileNames.has(image?.filename));

    const removedExistingImages =
      retainedImages === null
        ? []
        : existingImages.filter(
            (image: any) => image?.filename && !keepFileNames.has(image.filename),
          );

    await Promise.all(
      removedExistingImages.map(async (image: any) => {
        const imagePath = path.join("uploads", "images", image.filename);
        try {
          await fs.promises.unlink(imagePath);
        } catch {
          return;
        }
      }),
    );

    const finalImages = [...retainedExistingImages, ...formattedNewImages];

    const pdfFile = files.pdf_file?.[0];
    const pdfMeta = pdfFile
      ? {
          filename: pdfFile.filename,
          mimetype: pdfFile.mimetype,
          size: pdfFile.size,
          url: `/uploads/pdf/${pdfFile.filename}`,
        }
      : pitch.pdf_files;

    await pitch.update({
      warehouse_location: safeParse(warehouse_location) ?? warehouse_location,
      warehouse_size: warehouse_size ?? pitch.warehouse_size,
      warehouse_compliance: safeParse(warehouse_compliance) || pitch.warehouse_compliance,
      material_details: safeParse(material_details) || pitch.material_details,
      justification: justification ?? pitch.justification,
      image_files: finalImages,
      pdf_files: pdfMeta,
      rate_details: rate_details ?? pitch.rate_details,
      status: status ?? pitch.status,
    });

    return res.status(200).json({
      success: true,
      message: "Pitch updated successfully",
      data: pitch.toJSON(),
    });
  } catch (err: any) {
    console.error("❌ Update pitch error:", err.message);
    return sendErrorResponse(res, 500, "Failed to update pitch", err);
  }
};


// ---------- GET PITCHES FOR USER WITH COMPANY FILTER ----------
export const getPitchesForUser = async (req: Request, res: Response) => {
  try {
    const { login_id, company_id } = req.body;

    if (!login_id || isNaN(Number(login_id))) {
      return sendErrorResponse(res, 400, "login_id must be a valid number");
    }

    const loginIdNum = Number(login_id);
    const companyIdNum = company_id ? Number(company_id) : null;

    // Get pitches for this user with warehouse details
    const pitches = await Pitch.findAll({
      where: { login_id: loginIdNum },
      include: [{
        model: Warehouse,
        as: "warehouse",
        attributes: ['company_details'],
      }],
      order: [["id", "DESC"]],
    });

    if (pitches.length === 0) {
      return res.status(200).json({ success: true, pitches: [] });
    }

    // Map response and filter by company if provided
    let formattedRows = pitches.map((pitch: any) => {
      const warehouse = pitch.warehouse || {};
      const company = warehouse.company_details || {};
      return {
        ...pitch.toJSON(),
        company_id: company.id || null,
        company_name: company.company_name || null,
      };
    });

    // Filter by company_id if provided
    if (companyIdNum) {
      formattedRows = formattedRows.filter(
        (row: any) => row.company_id === companyIdNum
      );
    }

    res.status(200).json({ success: true, pitches: formattedRows });
  } catch (err: any) {
    console.error("Error fetching pitches for user:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch pitches", err);
  }
};

export const getWarehouseRequirementCompanyList = async (
  req: Request,
  res: Response,
) => {
  try {
    const { login_id } = req.body;
    if (!login_id || isNaN(Number(login_id))) {
      return sendErrorResponse(res, 400, "login_id must be a valid number");
    }

    const loginIdNum = Number(login_id);

    const pitches = await Pitch.findAll({
      where: { login_id: loginIdNum },
      include: [
        {
          model: Warehouse,
          as: "warehouse", // MUST match association
          attributes: ["company_details"],
          required: false,
        },
      ],
      raw: true,
    });

    // Extract unique companies
    const companiesMap = new Map<number, string>();

    pitches.forEach((row: any) => {
      const company = row["warehouse.company_details"];

      if (company?.id && company.company_name) {
        companiesMap.set(company.id, company.company_name);
      }
    });

    return res.status(200).json({
      success: true,
      data: Array.from(companiesMap.entries()).map(([id, name]) => ({
        company_id: id,
        company_name: name,
      })),
    });
  } catch (err: any) {
    console.error("Error fetching warehouse company list:", err);
    return sendErrorResponse(
      res,
      500,
      "Failed to fetch company list",
      err.message
    );
  }
};


export const deletePitch = async (req: Request, res: Response) => {
  try {
    const { pitch_id, login_id } = req.body;

    if (!pitch_id) {
      return sendErrorResponse(res, 400, "Pitch ID is required");
    }

    // Find pitch with authorization check
    const pitch = await Pitch.findByPk(Number(pitch_id));

    if (!pitch) {
      return sendErrorResponse(res, 404, "Pitch not found");
    }

    // Check ownership if login_id provided
    if (login_id && pitch.login_id !== Number(login_id)) {
      return sendErrorResponse(res, 403, "You do not have permission to delete this pitch");
    }

    // Check if approved pitches can be deleted
    if (pitch.status && pitch.status.toLowerCase() === "approved") {
      return sendErrorResponse(res, 403, "Approved pitches cannot be deleted");
    }

    await pitch.destroy();

    return res.status(200).json({
      success: true,
      message: "Pitch deleted successfully",
    });
  } catch (err: any) {
    console.error("❌ Delete pitch error:", err.message);
    return sendErrorResponse(res, 500, "Failed to delete pitch", err);
  }
};

