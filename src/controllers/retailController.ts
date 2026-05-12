import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import { Retail, RetailPitch, User, Payment } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";
import { Op } from "sequelize";
import sequelize from "../config/data-source";
import fs from "fs";
import path from "path";

const parseRequestBody = (req: Request) => {
  if (!req.body?.data) {
    return req.body;
  }

  try {
    return { ...req.body, ...JSON.parse(req.body.data) };
  } catch {
    return req.body;
  }
};

const moveRetailPdfFile = (retailId: number, pdfFile: Express.Multer.File) => {
  const retailPdfDir = path.join("uploads", "pdf", `retail_${retailId}`);

  if (!fs.existsSync(retailPdfDir)) {
    fs.mkdirSync(retailPdfDir, { recursive: true });
  }

  const currentPath = path.join("uploads", "pdf", pdfFile.filename);
  const destinationPath = path.join(retailPdfDir, pdfFile.filename);

  if (fs.existsSync(currentPath)) {
    fs.renameSync(currentPath, destinationPath);
  }

  return {
    filename: pdfFile.filename,
    mimetype: pdfFile.mimetype,
    size: pdfFile.size,
    url: `/uploads/pdf/retail_${retailId}/${pdfFile.filename}`,
  };
};

const copyRetailPdfFile = (retailId: number, pdfFile: Express.Multer.File) => {
  const retailPdfDir = path.join("uploads", "pdf", `retail_${retailId}`);

  if (!fs.existsSync(retailPdfDir)) {
    fs.mkdirSync(retailPdfDir, { recursive: true });
  }

  const currentPath = path.join("uploads", "pdf", pdfFile.filename);
  const destinationPath = path.join(retailPdfDir, pdfFile.filename);

  if (fs.existsSync(currentPath)) {
    fs.copyFileSync(currentPath, destinationPath);
  }

  return {
    filename: pdfFile.filename,
    mimetype: pdfFile.mimetype,
    size: pdfFile.size,
    url: `/uploads/pdf/retail_${retailId}/${pdfFile.filename}`,
  };
};

const hasSuccessfulPayment = async (userIds: number[]): Promise<boolean> => {
  const cleanUserIds = userIds.filter((value, index, arr) => Number.isFinite(value) && value > 0 && arr.indexOf(value) === index);
  if (cleanUserIds.length === 0) {
    return false;
  }

  const latestPayment = await Payment.findOne({
    where: {
      user_id: { [Op.in]: cleanUserIds },
    },
    order: [["updated_at", "DESC"], ["created_at", "DESC"]],
  });

  if (!latestPayment) {
    return false;
  }

  const paymentStatus = String(latestPayment?.status || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const isPaymentFailed = /(fail|error|cancel|declin|denied|reject|void|timeout|expire)/.test(paymentStatus);
  return !isPaymentFailed && /(success|successful|paid|captur|complete|succeed)/.test(paymentStatus);
};

// ✅ CREATE Retail
export const createRetail = async (req: Request, res: Response) => {
  const body = parseRequestBody(req);
  const {
    retail_details,
    retail_type,
    retail_compliance,
    login_id,
    description,
    status,
    company_details,
  } = body;

  if (!login_id) {
    return sendErrorResponse(res, 400, "login_id is required");
  }

  try {
    const retail = await Retail.create({
      retail_details: retail_details,
      retail_type: retail_type || [],
      login_id: Number(login_id),
      retail_compliance: retail_compliance || {},
      description: description || "",
      pdf_file: null,
      status: status || "pending",
      company_details: company_details || {},
    });

    const pdfFile = (req.file as Express.Multer.File | undefined) || null;

    if (pdfFile) {
      const pdfMeta = moveRetailPdfFile(retail.id, pdfFile);
      await retail.update({ pdf_file: pdfMeta });
    }

    res.status(201).json({
      success: true,
      message: "Retail created successfully",
      data: retail.toJSON(),
    });
  } catch (err: any) {
    console.error("Create Retail Error:", err.message);
    return sendErrorResponse(res, 500, "Failed to create retail", err);
  }
};

// ✅ GET Retails for Current User
export const createBulkRetail = async (req: Request, res: Response) => {
  const body = parseRequestBody(req);

  const {
    retail_details,
    retail_type,
    retail_compliance,
    login_id: bodyLoginId,
    loginId,
    company_id,
    companyId,
    description,
    status,
    company_details,
    retails,
    locations,
    retail_locations,
    location_list,
  } = body;
  const pdfFile = (req.file as Express.Multer.File | undefined) || null;

  if (Array.isArray(retails)) {
    if (retails.length === 0) {
      return sendErrorResponse(res, 400, "retails are required");
    }

    const invalidRetail = retails.find((retail: any) => {
      const retailLoginId =
        retail?.login_id ??
        retail?.loginId ??
        retail?.company_id ??
        retail?.companyId ??
        req.user?.login_id ??
        req.user?.id ??
        req.user?.userId;

      return !retailLoginId;
    });

    if (invalidRetail) {
      return sendErrorResponse(res, 400, "login_id is required for every retail");
    }

    try {
      const retailRows = retails.map((retail: any) => ({
        retail_details: retail.retail_details || {},
        retail_type: retail.retail_type || [],
        login_id: Number(
          retail.login_id ??
            retail.loginId ??
            retail.company_id ??
            retail.companyId ??
            req.user?.login_id ??
            req.user?.id ??
            req.user?.userId
        ),
        retail_compliance: retail.retail_compliance || {},
        description: retail.description || "",
        pdf_file: null,
        status: retail.status || "pending",
        company_details: retail.company_details || {},
      }));

      const createdRetails = await Retail.bulkCreate(retailRows, { returning: true });

      if (pdfFile) {
        await Promise.all(
          createdRetails.map((retail: any) =>
            retail.update({ pdf_file: copyRetailPdfFile(retail.id, pdfFile) })
          )
        );

        const uploadedPath = path.join("uploads", "pdf", pdfFile.filename);
        if (fs.existsSync(uploadedPath)) {
          fs.unlinkSync(uploadedPath);
        }
      }

      return res.status(201).json({
        success: true,
        message: "Retails created successfully",
        count: createdRetails.length,
        data: createdRetails.map((retail) => retail.toJSON()),
      });
    } catch (err: any) {
      console.error("Create Bulk Retail Error:", err.message);
      return sendErrorResponse(res, 500, "Failed to create retails", err);
    }
  }

  const login_id =
    bodyLoginId ??
    loginId ??
    company_id ??
    companyId ??
    req.user?.login_id ??
    req.user?.id ??
    req.user?.userId;

  if (!login_id) {
    return sendErrorResponse(res, 400, "login_id is required");
  }

  const locationInput =
    locations ??
    retail_locations ??
    location_list ??
    retail_details?.retail_locations ??
    retail_details?.locations ??
    retail_details?.retail_location;

  const locationList = Array.isArray(locationInput)
    ? locationInput
    : locationInput
      ? [locationInput]
      : [];

  if (locationList.length === 0) {
    return sendErrorResponse(res, 400, "locations are required");
  }

  try {
    const retailRows = locationList.map((location: any) => ({
      retail_details: {
        ...(retail_details || {}),
        retail_location: location,
      },
      retail_type: retail_type || [],
      login_id: Number(login_id),
      retail_compliance: retail_compliance || {},
      description: description || "",
      pdf_file: null,
      status: status || "pending",
      company_details: company_details || {},
    }));

    const retails = await Retail.bulkCreate(retailRows, { returning: true });

    if (pdfFile) {
      await Promise.all(
        retails.map((retail: any) =>
          retail.update({ pdf_file: copyRetailPdfFile(retail.id, pdfFile) })
        )
      );

      const uploadedPath = path.join("uploads", "pdf", pdfFile.filename);
      if (fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }
    }

    res.status(201).json({
      success: true,
      message: "Retails created successfully",
      count: retails.length,
      data: retails.map((retail) => retail.toJSON()),
    });
  } catch (err: any) {
    console.error("Create Bulk Retail Error:", err.message);
    return sendErrorResponse(res, 500, "Failed to create retails", err);
  }
};

export const getRetailsCurrUser = async (req: Request, res: Response) => {
  const { login_id } = req.params;
  try {
    if (!login_id || isNaN(Number(login_id))) {
      return sendErrorResponse(res, 400, "login_id must be a valid number");
    }

    const retails = await Retail.findAll({
      where: { login_id: Number(login_id) },
      order: [["id", "DESC"]],
    });
    res.status(200).json({ 
      success: true,
      retails: retails.map(r => r.toJSON()) 
    });
  } catch (err: any) {
    console.error(`Error fetching retails for login_id ${login_id}:`, err.message);
    return sendErrorResponse(res, 500, "Failed to fetch retails", err);
  }
};

export const getRetailById = async (req: Request, res: Response) => {
  const { login_id, id } = req.params;
  if (!id) {
    return sendErrorResponse(res, 400, "Retail ID is required");
  }

  try {
    const retail = await Retail.findByPk(Number(id));

    if (!retail) {
      return sendErrorResponse(res, 404, "Retail not found");
    }

    const pitches = await RetailPitch.findAll({
      where: { retail_id: Number(id) },
    });

    // Fetch user and check role
    const user = await User.findByPk(Number(login_id));
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const requesterUserId = Number(login_id);
    const isSelfRetail = Number(retail.login_id) === requesterUserId;
    const isCompanySelfRetail = user.role === "company" && isSelfRetail;

    if (!isCompanySelfRetail) {
      const paymentDone = await hasSuccessfulPayment([requesterUserId]);
      if (!paymentDone) {
        return res.status(200).json({
          success: false,
          message: "Payment not done",
        });
      }
    }

    if (pitches.length > 0) {
      const filteredPitches =
        user.role === "company"
          ? pitches.map(p => p.toJSON())
          : pitches.filter((item) => String(item.login_id) === String(login_id)).map(p => p.toJSON());

      return res.status(200).json({
        success: true,
        data: {
          ...retail.toJSON(),
          pitches: filteredPitches,
        },
      });
    }

    return res.status(200).json({ success: true, data: retail.toJSON() });
  } catch (err: any) {
    console.error("Error fetching retail and pitches:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch retail", err);
  }
};

// ✅ UPDATE Retail
export const updateRetail = async (req: Request, res: Response) => {
  const body = parseRequestBody(req);
  const {
    id,
    retail_id,
    login_id,
    loginId,
    company_id,
    companyId,
    retail_details,
    retail_type,
    retail_compliance,
    description,
    status,
    company_details,
  } = body;

  const retailId = id ?? retail_id;
  const loginIdValue = login_id ?? loginId ?? company_id ?? companyId;

  if (!retailId || !loginIdValue) {
    return sendErrorResponse(res, 400, "id and login_id are required");
  }

  try {
    // Check if record exists and belongs to this user
    const retail = await Retail.findOne({
      where: { login_id: Number(loginIdValue), id: Number(retailId) },
    });

    if (!retail) {
      return sendErrorResponse(res, 403, "You do not have permission to edit this retail");
    }

    // Ensure retail_type is always an array
    const normalizedRetailType = Array.isArray(retail_type)
      ? retail_type
      : retail_type
        ? [retail_type]
        : [];

    const updatePayload: any = {
      retail_details: retail_details || retail.retail_details,
      retail_type:
        retail_type !== undefined ? normalizedRetailType : retail.retail_type,
      retail_compliance: retail_compliance || retail.retail_compliance,
      description:
        description !== undefined ? String(description || "") : retail.description || "",
      status: status || retail.status,
      company_details: company_details || retail.company_details,
    };

    const pdfFile = (req.file as Express.Multer.File | undefined) || null;

    if (pdfFile) {
      updatePayload.pdf_file = moveRetailPdfFile(retail.id, pdfFile);
    }

    // Update record
    await retail.update(updatePayload);

    res.status(200).json({
      success: true,
      message: "Retail updated successfully",
      data: retail.toJSON(),
    });
  } catch (err: any) {
    console.error("Error updating retail entry:", err.message);
    return sendErrorResponse(res, 500, "Failed to update retail", err);
  }
};

// ✅ DELETE Retail (only when status is submitted & owned by user)
export const deleteRetail = async (req: Request, res: Response) => {
  const { retail_id, login_id } = req.params;
  if (!retail_id || !login_id) {
    return sendErrorResponse(res, 400, "retail_id and login_id are required");
  }

  try {
    // Fetch retail record
    const retail = await Retail.findByPk(Number(retail_id));

    if (!retail) {
      return sendErrorResponse(res, 404, "Retail not found");
    }

    // Ownership check
    if (String(retail.login_id) !== String(login_id)) {
      return sendErrorResponse(res, 403, "You do not have permission to delete this retail");
    }

    // Status check (safe)
    if (retail.status?.trim().toLowerCase() !== "submitted") {
      return sendErrorResponse(res, 400, "Retail can only be deleted when status is 'submitted'");
    }

    // Delete
    await retail.destroy();

    return res.status(200).json({
      success: true,
      message: "Retail deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete Retail Error:", error.message);
    return sendErrorResponse(res, 500, "Failed to delete retail", error);
  }
};

export const getRetailCompanyList = async (req: Request, res: Response) => {
  try {
    const retails = await Retail.findAll({
      where: { status: "approved" },
      attributes: ["id", "login_id", "company_details"],
      order: [["login_id", "ASC"]],
    });

    if (retails.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Extract unique companies
    const uniqueCompanies = new Map<number, { id: number; name: string | null }>();
    
    retails.forEach((row: any) => {
      const details = row.company_details;
      if (row.login_id && !uniqueCompanies.has(row.login_id)) {
        const companyName = details?.company_name || null;
        uniqueCompanies.set(row.login_id, {
          id: row.login_id,
          name: companyName,
        });
      }
    });

    // Return retail_id, company_id, company_name
    const data = Array.from(uniqueCompanies.values()).map((company) => ({
      retail_id: retails.find((r: any) => r.login_id === company.id)?.id,
      company_id: company.id,
      company_name: company.name,
    }));

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching retail company list:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch company list", err);
  }
};


export const getAllRetailsByLocation = async (req: Request, res: Response) => {
  const { login_id, location } = req.query;

  // Validate login_id
  if (!login_id || isNaN(Number(login_id))) {
    return sendErrorResponse(res, 400, "login_id is required and must be a number");
  }

  try {
    let where: any = { login_id: Number(login_id) };

    // Apply location filter ONLY if not "all" (retail_details is JSONB)
    if (location && location !== "all") {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.cast(sequelize.col('retail_details'), 'text'),
          Op.like,
          `%${location}%`
        )
      );
    }

    const retails = await Retail.findAll({
      where,
      order: [["id", "DESC"]],
    });

    // Fetch all pitches for these retails
    const retailIds = retails.map((r: any) => r.id);
    let pitches: any[] = [];
    if (retailIds.length > 0) {
      const pitchResults = await RetailPitch.findAll({
        where: {
          retail_id: { [Op.in]: retailIds },
        },
      });
      pitches = pitchResults;
    }

    // Attach pitches to corresponding retail
    const retailsWithPitches = retails.map((retail: any) => ({
      ...retail.toJSON(),
      pitches: pitches
        .filter((p: any) => p.retail_id === retail.id)
        .map((p: any) => p.toJSON()),
    }));

    res.status(200).json({
      success: true,
      retails: retailsWithPitches,
    });
  } catch (err: any) {
    console.error("Error fetching retails:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch retails", err);
  }
};

export const getAllRetailsByCompany = async (req: Request, res: Response) => {
  const { company_id, login_id } = req.query;

  try {
    let where: any = { status: "approved" };

    const requesterUserIdRaw =
      login_id ?? req.user?.id ?? req.user?.login_id ?? req.user?.userId;
    const requesterUserId = Number(requesterUserIdRaw);

    // Optional filter by company_id
    if (company_id && company_id !== "all" && !isNaN(Number(company_id))) {
      const companyIdNum = Number(company_id);

      if (Number.isFinite(requesterUserId) && requesterUserId > 0 && requesterUserId !== companyIdNum) {
        const paymentDone = await hasSuccessfulPayment([requesterUserId]);
        if (!paymentDone) {
          return res.status(200).json({
            success: false,
            message: "Payment not done",
          });
        }
      }

      // Filter by company_id in company_details JSON (cast JSONB to text first)
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.cast(sequelize.col('company_details'), 'text'),
          Op.like,
          `%"id": ${companyIdNum}%`
        )
      );
    }

    const retails = await Retail.findAll({
      where,
      order: [["created_date", "DESC"]],
    });

    res.status(200).json({
      success: true,
      retails: retails.map(r => r.toJSON()),
    });
  } catch (err: any) {
    console.error("Error fetching retails by company:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch retails", err);
  }
};

export const getUserRetailsLocation = async (req: Request, res: Response) => {
  const { login_id } = req.query;

  if (!login_id || isNaN(Number(login_id))) {
    return sendErrorResponse(res, 400, "login_id is required and must be numeric");
  }

  try {
    const retails = await Retail.findAll({
      where: { login_id: Number(login_id) },
      attributes: ["retail_details"],
      raw: true,
    });

    if (retails.length === 0) {
      return res.status(200).json({ success: true, locations: [] });
    }

    // Extract unique locations from retail_location
    const locationSet = new Set<string>();
    retails.forEach((retail: any) => {
      if (retail.retail_details?.retail_location?.display_name) {
        locationSet.add(retail.retail_details.retail_location.display_name);
      }
    });

    const locations = Array.from(locationSet).sort();

    return res.status(200).json({ 
      success: true,
      locations 
    });
  } catch (err: any) {
    console.error("Error fetching retail locations:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch locations", err);
  }
};
