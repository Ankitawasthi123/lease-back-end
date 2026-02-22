import { Router, Request, Response, response } from "express";
import { protect } from "../middleware/authMiddleware";
import { CompanyRequirements, Bid, User } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";
import { Op } from "sequelize";
import sequelize from "../config/data-source";

// Create a new company requirement
export const createRequirement = async (req: Request, res: Response) => {
  const {
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
    labour_details,
    office_expenses,
    company_id,
    transport,
    requirement_type,
    bid_details,
    distance,
    status,
  } = req.body;

  if (!company_id) {
    return sendErrorResponse(res, 400, "company_id is required");
  }

  if (!requirement_type) {
    return sendErrorResponse(res, 400, "requirement_type is required");
  }

  try {
    const requirement = await CompanyRequirements.create({
      warehouse_location: warehouse_location || {},
      company_id: Number(company_id),
      warehouse_size: warehouse_size || {},
      warehouse_compliance: warehouse_compliance || {},
      material_details: material_details || {},
      labour_details: labour_details || {},
      office_expenses: office_expenses || {},
      transport: transport || [],
      requirement_type,
      bid_details: bid_details || {},
      distance: distance || [],
      status: status || "submitted",
    });

    res.status(201).json({
      success: true,
      message: "Requirement created successfully",
      data: requirement.toJSON(),
    });
  } catch (err: any) {
    console.error("Create Requirement Error:", err.message);
    return sendErrorResponse(res, 500, "Failed to create requirement", err);
  }
};

export const updateCompanyRequirements = async (req: Request, res: Response) => {
  const {
    id,
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
    labour_details,
    office_expenses,
    company_id,
    transport,
    requirement_type,
    bid_details,
    distance,
  } = req.body;

  if (!id || !company_id) {
    return sendErrorResponse(res, 400, "id and company_id are required");
  }

  try {
    const requirement = await CompanyRequirements.findOne({
      where: { id: Number(id), company_id: Number(company_id) },
    });

    if (!requirement) {
      return sendErrorResponse(res, 404, "Requirement not found");
    }

    await requirement.update({
      warehouse_location: warehouse_location || requirement.warehouse_location,
      warehouse_size: warehouse_size || requirement.warehouse_size,
      warehouse_compliance: warehouse_compliance || requirement.warehouse_compliance,
      material_details: material_details || requirement.material_details,
      labour_details: labour_details || requirement.labour_details,
      office_expenses: office_expenses || requirement.office_expenses,
      transport: transport || requirement.transport,
      requirement_type: requirement_type || requirement.requirement_type,
      bid_details: bid_details || requirement.bid_details,
      distance: distance || requirement.distance,
    });

    res.status(200).json({
      success: true,
      message: "Requirement updated successfully",
      data: requirement.toJSON(),
    });
  } catch (err: any) {
    console.error("Update error:", err.message);
    return sendErrorResponse(res, 500, "Failed to update requirement", err);
  }
};

export const getCurrRequirment = async (req: Request, res: Response) => {
  const { id } = req.body;

  if (!id) {
    return sendErrorResponse(res, 400, "ID is required");
  }

  try {
    const companyIdParsed = parseInt(id, 10);

    if (isNaN(companyIdParsed)) {
      return sendErrorResponse(res, 400, "ID must be a valid number");
    }

    const requirement = await CompanyRequirements.findByPk(companyIdParsed);

    if (!requirement) {
      return sendErrorResponse(res, 404, "Requirement not found");
    }

    res.status(200).json({
      success: true,
      data: requirement.toJSON(),
    });
  } catch (err: any) {
    console.error("Error fetching company requirements:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch requirement", err);
  }
};

export const getCompanyList = async (req: Request, res: Response) => {
  try {
    const login_id = req.user?.login_id || req.user?.id;
    const numericLoginId = login_id ? Number(login_id) : null;
    if (!numericLoginId) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }

    // Fetch requirements where status is approved or company_id matches
    const requirements = await CompanyRequirements.findAll({
      where: {
        [Op.or]: [
          { status: "approved" },
          { company_id: numericLoginId },
        ],
      },
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Map and deduplicate
    const uniqueCompanies = new Map<string, string>();
    requirements.forEach((req: any) => {
      const company = req.bid_details || {};
      const key = `${req.company_id}`;
      if (!uniqueCompanies.has(key)) {
        uniqueCompanies.set(key, company.company_name || null);
      }
    });

    const data = Array.from(uniqueCompanies.entries()).map(([id, name]) => ({
      company_id: parseInt(id),
      company_name: name,
    }));

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching company data:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch companies", err);
  }
};


export const getRequirementDetails = async (req: Request, res: Response) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return sendErrorResponse(res, 405, `Method ${req.method} not allowed`);
  }

  const { id, company_id, role } = req.body;
  if (!id || !company_id) {
    return sendErrorResponse(res, 400, "id and company_id are required");
  }

  const requirementId = parseInt(id, 10);
  const companyId = parseInt(company_id, 10);
  if (isNaN(requirementId) || isNaN(companyId)) {
    return sendErrorResponse(res, 400, "id and company_id must be numeric");
  }

  try {
    // Fetch the requirement
    let requirement;
    if (role === "threepl") {
      requirement = await CompanyRequirements.findByPk(requirementId);
    } else {
      requirement = await CompanyRequirements.findOne({
        where: { id: requirementId, company_id: companyId },
      });
    }

    if (!requirement) {
      return sendErrorResponse(res, 404, "Requirement not found");
    }

    // Fetch related bids
    const bids = await Bid.findAll({
      where: { requirement_id: requirementId },
    });

    let filteredBids = bids;
    // If the user is a 3PL, only keep their own bid details
    if (role === "threepl" && company_id) {
      filteredBids = bids.map((bid: any) => {
        if (bid.pl_details?.id === company_id) {
          return bid.toJSON();
        } else {
          return {
            ...bid.toJSON(),
            bid_details: {},
          };
        }
      });
    } else {
      filteredBids = bids.map((b: any) => b.toJSON());
    }

    return res.status(200).json({
      success: true,
      data: {
        ...requirement.toJSON(),
        bids: filteredBids,
      },
    });
  } catch (err: any) {
    console.error("Error fetching requirement details:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch requirement details", err);
  }
};

export const deleteCompanyRequirements = async (req: Request, res: Response) => {
  const { company_id, requirement_id } = req.body;
  if (!requirement_id || !company_id) {
    return sendErrorResponse(res, 400, "requirement_id and company_id are required");
  }

  try {
    const requirementIdParsed = parseInt(requirement_id, 10);
    const loginIdParsed = parseInt(company_id, 10);

    if (isNaN(requirementIdParsed) || isNaN(loginIdParsed)) {
      return sendErrorResponse(res, 400, "IDs must be valid numbers");
    }

    // Fetch user and check role
    const user = await User.findByPk(loginIdParsed);
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const isAdmin = user.role === "admin";

    // Fetch requirement
    const requirement = await CompanyRequirements.findByPk(requirementIdParsed);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Requirement not found");
    }

    // Check permissions for normal users
    if (!isAdmin) {
      if (Number(requirement.company_id) !== loginIdParsed) {
        return sendErrorResponse(res, 403, "You do not have permission to delete this requirement");
      }

      if (requirement.status !== "submitted") {
        return sendErrorResponse(res, 400, "Only submitted requirements can be deleted");
      }
    }

    // Delete
    await requirement.destroy();

    return res.status(200).json({
      success: true,
      message: "Requirement deleted successfully",
    });
  } catch (err: any) {
    console.error("Delete requirement error:", err.message);
    return sendErrorResponse(res, 500, "Failed to delete requirement", err);
  }
};

export const getLocationListLocationsByUser = async (
  req: Request,
  res: Response,
) => {
  const { login_id } = req.params;

  if (!login_id || isNaN(Number(login_id))) {
    return sendErrorResponse(res, 400, "login_id is required and must be numeric");
  }

  const companyId = Number(login_id);

  try {
    const requirements = await CompanyRequirements.findAll({
      where: { company_id: companyId },
      attributes: ["warehouse_location"],
      raw: true,
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, locations: [] });
    }

    // Extract unique display names
    const locationSet = new Set<string>();
    requirements.forEach((req: any) => {
      if (req.warehouse_location?.display_name) {
        locationSet.add(req.warehouse_location.display_name);
      }
    });

    const locations = Array.from(locationSet).sort();

    return res.status(200).json({
      success: true,
      company_id: companyId,
      locations,
    });
  } catch (err: any) {
    console.error("Error fetching warehouse locations:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch locations", err);
  }
};

export const liveBids = async (req: Request, res: Response) => {
  try {
    const login_id = req.params.login_id ? Number(req.params.login_id) : null;
    if (!login_id) {
      return sendErrorResponse(res, 400, "login_id is required");
    }

    // Get user role
    const user = await User.findByPk(login_id);
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const { role } = user;

    // Fetch requirements
    let requirementsWhere: any = {};
    if (role === "company") {
      requirementsWhere.company_id = login_id;
    }

    const requirements = await CompanyRequirements.findAll({
      where: requirementsWhere,
      order: [["created_date", "DESC"]],
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Collect requirement IDs
    const requirementIds = requirements.map((r: any) => r.id);

    // Fetch bids
    let bids: any[] = [];
    
    if (role === "threepl") {
      // For 3PL, filter bids manually
      const allBids = await Bid.findAll({
        where: {
          requirement_id: { [Op.in]: requirementIds },
        },
        order: [["created_date", "DESC"]],
      });
      bids = allBids.filter((b: any) => b.pl_details?.id === login_id);
    } else {
      bids = await Bid.findAll({
        where: {
          requirement_id: { [Op.in]: requirementIds },
        },
        order: [["created_date", "DESC"]],
      });
    }

    // Attach bids to requirements
    const enrichedRequirements = requirements
      .map((req: any) => {
        const reqBids = bids.filter((bid: any) => bid.requirement_id === req.id);

        // For 3PL: skip this requirement if they have not placed any bid
        if (role === "threepl" && !reqBids.some((bid: any) => bid.pl_details?.id === login_id)) {
          return null;
        }

        return {
          ...req.toJSON(),
          bids: reqBids.map((b: any) => b.toJSON()),
        };
      })
      .filter(Boolean);

    return res.status(200).json({ success: true, data: enrichedRequirements });
  } catch (err: any) {
    console.error("Error fetching live bids:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch bids", err);
  }
};

export const getCompanyRequirementsList = async (req: Request, res: Response) => {
  try {
    const login_id = Number(req.body.login_id);
    const location = req.body.location; // optional

    if (!login_id) {
      return sendErrorResponse(res, 400, "login_id is required");
    }

    let where: any = { company_id: login_id };

    if (location && location !== "null") {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.cast(sequelize.col('warehouse_location'), 'text'),
          Op.like,
          `%"display_name": "${location}"%`
        )
      );
    }

    const requirements = await CompanyRequirements.findAll({
      where,
      order: [["created_date", "DESC"]],
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch bids for these requirements
    const requirementIds = requirements.map((r: any) => r.id);
    const bids = await Bid.findAll({
      where: {
        requirement_id: { [Op.in]: requirementIds },
      },
    });

    // Merge bids into requirements
    const enrichedRequirements = requirements.map((req: any) => ({
      ...req.toJSON(),
      bids: bids.filter((b: any) => b.requirement_id === req.id).map((b: any) => b.toJSON()),
    }));

    return res.status(200).json({ success: true, data: enrichedRequirements });
  } catch (error: any) {
    console.error("🔥 API ERROR:", error.message);
    return sendErrorResponse(res, 500, "Failed to fetch requirements", error);
  }
};

export const threePlRequirements = async (req: Request, res: Response) => {
  try {
    const company_id = req.body.company_id ? Number(req.body.company_id) : null;
    const login_id = req.body.login_id ? Number(req.body.login_id) : null;

    if (!login_id) {
      return sendErrorResponse(res, 400, "login_id is required");
    }

    // Build requirements query
    let where: any = {};

    if (company_id) {
      where.company_id = company_id;

      // If login_id doesn't match company_id → only approved
      if (company_id !== login_id) {
        where.status = "approved";
      }
    }

    // Fetch requirements
    const requirements = await CompanyRequirements.findAll({
      where,
      order: [["created_date", "DESC"]],
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch bids for these requirements filtered by login_id inside pl_details JSON
    const requirementIds = requirements.map((r: any) => r.id);

    const bids = await Bid.findAll({
      where: {
        requirement_id: { [Op.in]: requirementIds },
      },
      order: [["created_date", "DESC"]],
    });

    // Filter bids where pl_details.id matches login_id
    const filteredBids = bids.filter((b: any) => b.pl_details?.id === login_id);

    // Merge bids into requirements
    const enrichedRequirements = requirements.map((req: any) => ({
      ...req.toJSON(),
      bids: filteredBids.filter((b: any) => b.requirement_id === req.id).map((b: any) => b.toJSON()),
    }));

    return res.status(200).json({ success: true, data: enrichedRequirements });
  } catch (error: any) {
    console.error("🔥 API ERROR:", error.message);
    return sendErrorResponse(res, 500, "Failed to fetch requirements", error);
  }
};
