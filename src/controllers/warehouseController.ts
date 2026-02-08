import { Router, Request, Response, response } from "express";
import { protect } from "../middleware/authMiddleware";
import { Warehouse, Pitch, User } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";
import { Op } from "sequelize";
import sequelize from "../config/data-source";
import {
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  DeleteWarehouseRequest,
  WarehouseResponse,
} from "../models/Warehouse";

export const createWarehouse = async (
  req: Request<{}, {}, CreateWarehouseRequest>,
  res: Response<any>,
) => {
  const {
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
    login_id,
    status,
    company_details,
  } = req.body;

  if (!login_id) {
    return sendErrorResponse(res, 400, "login_id is required");
  }

  try {
    const warehouse = await Warehouse.create({
      login_id: Number(login_id),
      warehouse_location: warehouse_location || {},
      warehouse_size: warehouse_size || {},
      warehouse_compliance: warehouse_compliance || {},
      material_details: material_details || {},
      status: status || "submitted",
      company_details: company_details || {},
    });

    res.status(201).json({
      success: true,
      message: "Warehouse created successfully",
      data: warehouse.toJSON(),
    });
  } catch (err: any) {
    console.error("Create warehouse error:", err.message);
    return sendErrorResponse(res, 500, "Failed to create warehouse", err);
  }
};

export const getWarehousesCurrUser = async (
  req: Request<{ login_id: string }>,
  res: Response<any>,
) => {
  const { login_id } = req.params;

  if (!login_id || isNaN(Number(login_id))) {
    return sendErrorResponse(res, 400, "login_id must be a valid number");
  }

  try {
    const warehouses = await Warehouse.findAll({
      where: { login_id: Number(login_id) },
      order: [["created_date", "DESC"]],
    });
    res.status(200).json({ 
      success: true,
      warehouses: warehouses.map(w => w.toJSON()) 
    });
  } catch (err: any) {
    console.error(`Error fetching warehouses for login_id ${login_id}:`, err.message);
    return sendErrorResponse(res, 500, "Failed to fetch warehouses", err);
  }
};

export const getWarehouseById = async (
  req: Request<{ login_id: string; id: string }>,
  res: Response,
) => {
  const { login_id, id } = req.params;

  if (!login_id || !id) {
    return sendErrorResponse(res, 400, "login_id and warehouse id are required");
  }

  try {
    // 1️⃣ Fetch warehouse
    const warehouse = await Warehouse.findByPk(Number(id));

    if (!warehouse) {
      return sendErrorResponse(res, 404, "Warehouse not found");
    }

    // 2️⃣ Fetch user role
    const user = await User.findByPk(Number(login_id));

    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const { role } = user.toJSON();

    // 3️⃣ Build pitch query based on role
    let pitches: any[] = [];

    // 🟢 Company → all pitches
    if (role === "company") {
      const pitchResults = await Pitch.findAll({
        where: { warehouse_id: Number(id) },
      });
      pitches = pitchResults.map(p => p.toJSON());
    }

    // 🔵 ThreePL
    else if (role === "threepl") {
      const pitchResults = await Pitch.findAll({
        where: { 
          warehouse_id: Number(id),
        },
      });
      // Filter pitches that belong to user or warehouse owner
      pitches = pitchResults
        .filter(p => p.login_id == Number(login_id) || warehouse.login_id == Number(login_id))
        .map(p => p.toJSON());
    }

    // 🟣 Owner / Agent
    else if (role === "owner" || role === "agent") {
      const pitchResults = await Pitch.findAll({
        where: { 
          warehouse_id: Number(id),
          login_id: Number(login_id)
        },
      });
      pitches = pitchResults.map(p => p.toJSON());
    }

    // 4️⃣ Always return warehouse + pitches (even if empty)
    return res.status(200).json({
      success: true,
      data: {
        ...warehouse.toJSON(),
        pitches: pitches ?? [],
      },
    });

  } catch (err: any) {
    console.error("Error fetching warehouse:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch warehouse", err);
  }
};

export const updateWarehouse = async (
  req: Request<{}, {}, UpdateWarehouseRequest>,
  res: Response<any>,
) => {
  const { login_id, id } = req.body;

  if (!id || !login_id) {
    return sendErrorResponse(res, 400, "id and login_id are required");
  }

  const {
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
  } = req.body;

  try {
    // Check if warehouse exists
    const existing = await Warehouse.findOne({
      where: { login_id: Number(login_id), id: Number(id) },
    });

    if (!existing) {
      return sendErrorResponse(res, 403, "You do not have permission to edit this warehouse");
    }

    // Update warehouse
    await existing.update({
      warehouse_location: warehouse_location || existing.warehouse_location,
      warehouse_size: warehouse_size || existing.warehouse_size,
      warehouse_compliance: warehouse_compliance || existing.warehouse_compliance,
      material_details: material_details || existing.material_details,
    });

    res.status(200).json({
      success: true,
      message: "Warehouse updated successfully",
      data: existing.toJSON() as WarehouseResponse,
    });
  } catch (err: any) {
    console.error("Error updating warehouse:", err.message);
    return sendErrorResponse(res, 500, "Failed to update warehouse", err);
  }
};

export const deleteWarehouse = async (
  req: Request<{}, {}, DeleteWarehouseRequest>,
  res: Response<any>,
) => {
  const { login_id, id } = req.body;

  if (!id || !login_id) {
    return sendErrorResponse(res, 400, "warehouse id and login_id are required");
  }

  try {
    // Fetch warehouse first
    const warehouse = await Warehouse.findByPk(Number(id));

    if (!warehouse) {
      return sendErrorResponse(res, 404, "Warehouse not found");
    }

    // Ownership check
    if (Number(warehouse.login_id) !== Number(login_id)) {
      return sendErrorResponse(res, 403, "You do not have permission to delete this warehouse");
    }

    // Delete
    await warehouse.destroy();

    return res.status(200).json({
      success: true,
      message: "Warehouse deleted successfully",
      id,
    });
  } catch (err: any) {
    console.error("Delete warehouse error:", err.message);
    return sendErrorResponse(res, 500, "Failed to delete warehouse", err);
  }
};

export const getWarehousesLocationByUser = async (
  req: Request,
  res: Response,
) => {
  const { login_id } = req.params;

  if (!login_id || isNaN(Number(login_id))) {
    return sendErrorResponse(res, 400, "login_id is required and must be numeric");
  }

  const companyId = Number(login_id);

  try {
    const warehouses = await Warehouse.findAll({
      where: { login_id: companyId },
      attributes: ['warehouse_location'],
      raw: true,
    });

    if (warehouses.length === 0) {
      return res.status(200).json({
        success: true,
        company_id: companyId,
        locations: [],
      });
    }

    // Extract unique display names
    const locationSet = new Set<string>();
    warehouses.forEach((w: any) => {
      if (w.warehouse_location?.display_name) {
        locationSet.add(w.warehouse_location.display_name);
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

export const getAllWarehousesThreePlList = async (
  req: Request<
    {},
    {},
    {},
    { login_id?: string; company_id?: string; location?: string }
  >,
  res: Response<any>,
) => {
  const { login_id, company_id, location } = req.query;

  const cleanLoginId =
    login_id && login_id !== "null" && login_id !== "undefined"
      ? login_id
      : null;

  const cleanCompanyId =
    company_id && company_id !== "null" && company_id !== "undefined"
      ? company_id
      : null;

  const cleanLocation =
    location && location !== "null" && location !== "undefined"
      ? location
      : null;

  try {
    let where: any = {};

    // CASE 1: First load → approved only
    if (!cleanLoginId) {
      where.status = { [Op.iLike]: 'approved' };
    }

    // CASE 2: login_id present BUT no company_id → show ONLY approved requests
    if (cleanLoginId && !cleanCompanyId) {
      where.status = { [Op.iLike]: 'approved' };
    }

    // CASE 3: login_id + company_id present
    if (cleanLoginId && cleanCompanyId) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.cast(sequelize.col('company_details'), 'text'),
          Op.like,
          `%"id": ${cleanCompanyId}%`
        )
      );
    }

    // Location filter
    if (cleanLocation) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.cast(sequelize.col('warehouse_location'), 'text'),
          Op.like,
          `%"display_name": "${cleanLocation}"%`
        )
      );
    }

    console.log("🔍 Filter:", where);

    const warehouses = await Warehouse.findAll({
      where,
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      warehouses: warehouses.map(w => w.toJSON()),
    });
  } catch (err: any) {
    console.error("Error fetching warehouses:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch warehouses", err);
  }
};

export const getWarehouseCompanyList = async (req: Request, res: Response) => {
  try {
    const rawLoginId = req.user?.login_id || req.user?.id;
    const login_id = rawLoginId != null ? String(rawLoginId) : null;

    console.log("Fetching warehouse company list for login_id:", login_id);

    if (!login_id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }

    // Fetch logged-in user's company_details
    const userWarehouse = await Warehouse.findOne({
      where: { login_id: Number(login_id) },
      attributes: ['company_details'],
    });

    let userCompanyDetails: any = {};
    if (userWarehouse && userWarehouse.company_details) {
      userCompanyDetails = userWarehouse.company_details;
    }

    const companyDetailId = userCompanyDetails?.id != null
      ? String(userCompanyDetails.id)
      : null;

    // Build base query
    let where: any = {};

    // Apply rules
    if (companyDetailId && companyDetailId === login_id) {
      // Case 1: company id matches → return all warehouses
      // no extra filter
    } else {
      // Case 2 & 3: company id is null or does not match → return approved warehouses
      console.log("Fetching only approved warehouses because company id is null or doesn't match");
      where.status = "approved";
    }

    // Execute query
    const warehouses = await Warehouse.findAll({
      where,
      attributes: ['login_id', 'company_details', 'status'],
      order: [['login_id', 'ASC']],
    });

    if (!warehouses.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Normalize response and remove duplicates
    const seenLoginIds = new Set<number>();
    const data = warehouses
      .map((row: any) => {
        let companyDetailsObj: any = row.company_details || {};

        return {
          login_id: row.login_id,
          company_name: companyDetailsObj.company_name || "",
          status: row.status || "",
        };
      })
      .filter((item) => {
        if (seenLoginIds.has(item.login_id)) {
          return false; // Skip duplicate
        }
        seenLoginIds.add(item.login_id);
        return true;
      });

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching warehouse company list:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch company list", err);
  }
};

export const getAllWarehousesList = async (
  req: Request<{}, {}, {}, { login_id?: string; location?: string }>,
  res: Response,
) => {
  const { login_id, location } = req.query;

  const cleanLoginId =
    login_id && login_id !== "null" && login_id !== "undefined"
      ? login_id
      : null;

  const cleanLocation =
    location && location !== "null" && location !== "undefined"
      ? location
      : null;

  try {
    let where: any = {};

    // Ownership + approval logic
    if (cleanLoginId) {
      where[Op.or] = [
        // User's own warehouses
        sequelize.where(
          sequelize.cast(sequelize.col('company_details'), 'text'),
          Op.like,
          `%"id": ${cleanLoginId}%`
        ),
        // Other's approved warehouses
        {
          [Op.and]: [
            sequelize.where(
              sequelize.cast(sequelize.col('company_details'), 'text'),
              Op.notLike,
              `%"id": ${cleanLoginId}%`
            ),
            { status: { [Op.iLike]: 'approved' } },
          ],
        },
      ];
    }

    // Location filter
    if (cleanLocation) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.cast(sequelize.col('warehouse_location'), 'text'),
          Op.like,
          `%"display_name": "${cleanLocation}"%`
        )
      );
    }

    const warehouses = await Warehouse.findAll({
      where,
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      warehouses: warehouses.map(w => w.toJSON()),
    });
  } catch (err: any) {
    console.error("Error fetching warehouses:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch warehouses", err);
  }
};

