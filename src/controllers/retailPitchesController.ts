import { Request, Response } from "express";
import { Retail, RetailPitch } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";
import { Op } from "sequelize";
import sequelize from "../config/data-source";
import fs from "fs";
import path from "path";

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

    if (!retail_id) {
      return sendErrorResponse(res, 400, "retail_id is required");
    }
    if (!login_id) {
      return sendErrorResponse(res, 400, "login_id is required");
    }
    if (!property_type) {
      return sendErrorResponse(res, 400, "property_type is required");
    }

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

    const existing = await RetailPitch.findOne({
      where: {
        [Op.and]: [
          sequelize.where(
            sequelize.cast(sequelize.col("retail_id"), "text"),
            Op.eq,
            String(retail_id)
          ),
          sequelize.where(
            sequelize.cast(sequelize.col("login_id"), "text"),
            Op.eq,
            String(login_id)
          ),
        ],
      },
    });

    if (existing) {
      return sendErrorResponse(res, 409, "A pitch for this retail already exists");
    }

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
      retail_pitches: pitches.map((p) => p.toJSON()),
    });
  } catch (err: any) {
    console.error("Error fetching retail pitches:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch retail pitches", err);
  }
};

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
        [Op.and]: [
          sequelize.where(
            sequelize.cast(sequelize.col("login_id"), "text"),
            Op.eq,
            String(login_id)
          ),
          sequelize.where(
            sequelize.cast(sequelize.col("retail_id"), "text"),
            Op.eq,
            String(retail_id)
          ),
        ],
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

    const pitch = await RetailPitch.findOne({
      where: {
        [Op.and]: [
          sequelize.where(
            sequelize.cast(sequelize.col("login_id"), "text"),
            Op.eq,
            String(login_id)
          ),
          sequelize.where(
            sequelize.cast(sequelize.col("id"), "text"),
            Op.eq,
            String(id)
          ),
        ],
      },
    });

    if (!pitch) {
      return sendErrorResponse(res, 403, "You do not have permission to edit this pitch");
    }

    const existingImages = Array.isArray(pitch.image_files)
      ? pitch.image_files
      : [];
    const newUploadedImages = (req.files as any)?.images || [];

    const formattedNewImages = newUploadedImages.map(
      (file: Express.Multer.File) => ({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/images/${file.filename}`,
      }),
    );

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
      return sendErrorResponse(
        res,
        400,
        "image_files must be a valid JSON array",
      );
    }

    const keepFileNames = new Set(
      (retainedImages || [])
        .map((image: any) => resolveImageFileName(image))
        .filter(Boolean),
    );

    const retainedExistingImages = existingImages.filter((image: any) =>
      keepFileNames.has(image?.filename),
    );

    const removedExistingImages = existingImages.filter(
      (image: any) =>
        image?.filename && !keepFileNames.has(image.filename),
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

    const newPdfFile = (req.files as any)?.pdf_file?.[0];

    const finalPdf = newPdfFile
      ? {
          filename: newPdfFile.filename,
          mimetype: newPdfFile.mimetype,
          size: newPdfFile.size,
          url: `/uploads/pdf/${newPdfFile.filename}`,
        }
      : pitch.pdf_files;

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
      where: { login_id: loginIdNum },
      include: [
        {
          model: Retail,
          as: "retail",
          attributes: ["company_details"],
          // ensure join compares same types to avoid text = integer errors
          on: sequelize.where(
            sequelize.cast(sequelize.col("retail.id"), "text"),
            Op.eq,
            sequelize.cast(sequelize.col("RetailPitch.retail_id"), "text")
          ),
          required: false,
        },
      ],
      order: [["id", "DESC"]],
      raw: true,
      subQuery: false,
    });

    if (pitches.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const uniqueCompanies = new Map<string, any>();
    pitches.forEach((row: any) => {
      let companyRaw = row["retail.company_details"] || {};

      // company_details may come back as a JSON string when using raw: true
      let company: any = {};
      if (typeof companyRaw === "string") {
        try {
          company = JSON.parse(companyRaw);
        } catch (e) {
          // fallback: leave as empty object
          company = {};
        }
      } else if (typeof companyRaw === "object" && companyRaw !== null) {
        company = companyRaw;
      }

      const companyId = company?.id;
      if (companyId != null && !uniqueCompanies.has(String(companyId))) {
        uniqueCompanies.set(String(companyId), {
          pitch_id: row.id,
          retail_id: row.retail_id,
          login_id: row.login_id,
          company_id: companyId,
          company_name: company.company_name || null,
        });
      }
    });

    const formattedRows = Array.from(uniqueCompanies.values());

    res.status(200).json({ success: true, data: formattedRows });
  } catch (err: any) {
    console.error("Error fetching retail pitch company list:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch company list", err);
  }
};

export const getRetailPitchesForUser = async (
  req: Request,
  res: Response
) => {
  const { login_id, company_id } = req.query;

  // Validate
  if (!login_id || isNaN(Number(login_id))) {
    return sendErrorResponse(res, 400, "login_id must be a valid number");
  }

  if (!company_id || isNaN(Number(company_id))) {
    return sendErrorResponse(res, 400, "company_id must be a valid number");
  }

  try {
    const pitches = await RetailPitch.findAll({
      where: {
        login_id: Number(login_id),
      },
      include: [
        {
          model: Retail,
          as: "retail",
          attributes: ["company_details"],
          required: true,
        },
      ],
      order: [["id", "DESC"]],
      raw: true,
    });

    // Filter by company_id AND return FULL pitch data
    const filteredPitches = pitches
      .filter((row: any) => {
        const company = row["retail.company_details"];
        return company?.id && Number(company.id) === Number(company_id);
      })
      .map((row: any) => ({
        pitch_id: row.id,
        retail_id: row.retail_id,
        login_id: row.login_id,

        // company
        company_id: row["retail.company_details"]?.id,
        company_name: row["retail.company_details"]?.company_name || null,

        // full pitch data
        retail_details: row.retail_details,
        retail_compliance: row.retail_compliance,
        property_type: row.property_type,
        justification: row.justification,
        status: row.status,
        created_date: row.created_date,
      }));

    return res.status(200).json({
      success: true,
      data: filteredPitches,
    });
  } catch (err: any) {
    console.error("Error fetching retail pitches for user:", err);
    return sendErrorResponse(res, 500, "Failed to fetch pitches", err.message);
  }
};
