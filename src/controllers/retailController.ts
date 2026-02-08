import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import { Retail, RetailPitch, User } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";
import { Op } from "sequelize";
import sequelize from "../config/data-source";

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

  if (!login_id) {
    return sendErrorResponse(res, 400, "login_id is required");
  }

  try {
    const retail = await Retail.create({
      retail_details: retail_details,
      retail_type: retail_type || [],
      login_id: Number(login_id),
      retail_compliance: retail_compliance || {},
      status: status || "pending",
      company_details: company_details || {},
    });

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
  const { id, login_id, retail_details, retail_type, retail_compliance } =
    req.body;

  if (!id || !login_id) {
    return sendErrorResponse(res, 400, "id and login_id are required");
  }

  try {
    // Check if record exists and belongs to this user
    const retail = await Retail.findOne({
      where: { login_id: Number(login_id), id: Number(id) },
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

    // Update record
    await retail.update({
      retail_details: retail_details || retail.retail_details,
      retail_type: normalizedRetailType,
      retail_compliance: retail_compliance || retail.retail_compliance,
    });

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
  const { company_id } = req.query;

  try {
    let where: any = { status: "approved" };

    // Optional filter by company_id
    if (company_id && company_id !== "all" && !isNaN(Number(company_id))) {
      const companyIdNum = Number(company_id);
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
