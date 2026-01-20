import { Router, Request, Response, response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";
import {
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  DeleteWarehouseRequest,
  WarehouseResponse,
} from "../models/warehouse";

export const createWarehouse = async (
  req: Request<{}, {}, CreateWarehouseRequest>,
  res: Response<WarehouseResponse>
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

  try {
    const result = await pool.query(
      `INSERT INTO warehouse (
        warehouse_location,
        login_id,
        warehouse_size,
        warehouse_compliance,
        material_details,
        status,
        company_details,
        created_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [
        JSON.stringify(warehouse_location || {}),
        login_id,
        warehouse_size,
        JSON.stringify(warehouse_compliance || {}),
        JSON.stringify(material_details || {}),
        status || "submitted",
        JSON.stringify(company_details || {}),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getAllWarehousesList = async (
  req: Request<
    {},
    {},
    {},
    { login_id?: string; location?: string }
  >,
  res: Response<{ warehouses: WarehouseResponse[] }>
) => {
  const { login_id, location } = req.query;

  try {
    let query = `SELECT * FROM warehouse`;
    const values: any[] = [];
    const conditions: string[] = [];

    /**
     * 🔹 Filter by current user (login_id)
     */
    if (login_id) {
      conditions.push(`login_id = $${values.length + 1}`);
      values.push(login_id);
    }

    /**
     * 🔹 Filter by location (only if provided)
     * Uses JSONB warehouse_location ->> display_name
     */
    if (location) {
      conditions.push(
        `warehouse_location->>'display_name' = $${values.length + 1}`
      );
      values.push(location);
    }

    /**
     * 🔹 Apply conditions if any
     */
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY id DESC`;

    const result = await pool.query(query, values);

    return res.status(200).json({
      warehouses: result.rows,
    });
  } catch (err: any) {
    console.error("Error fetching warehouses:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
};


export const getWarehousesCurrUser = async (
  req: Request<{ login_id: string }>,
  res: Response<{ warehouses: WarehouseResponse[] }>
) => {
  const { login_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM warehouse WHERE login_id = $1 ORDER BY id DESC`,
      [login_id]
    );
    res.status(200).json({ warehouses: result.rows });
  } catch (err: any) {
    console.error(`Error fetching warehouses for login_id ${login_id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

export const getWarehouseById = async (
  req: Request<{ login_id: string; id: string }>,
  res: Response<WarehouseResponse>
) => {
  const { login_id, id } = req.params;

  try {
    // Fetch warehouse
    const warehouseResult = await pool.query(
      `SELECT * FROM warehouse WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (warehouseResult.rows.length === 0) {
      return res.status(404).json({ error: "Warehouse not found" });
    }

    const warehouse = warehouseResult.rows[0];

    // Fetch pitches for warehouse
    const pitchesResult = await pool.query(
      `SELECT * FROM pitches WHERE warehouse_id = $1`,
      [id]
    );
    // If pitches exist, add them as a new property on warehouse object
    if (pitchesResult.rows.length > 0) {
      return res.status(200).json({
        ...warehouse,
        pitches:
          warehouse.login_id === login_id
            ? pitchesResult.rows
            : (() => {
                const pitch = pitchesResult.rows.find(
                  (p) => p.login_id === login_id
                );
                return pitch ? { pitch_id: pitch.id } : null;
              })(),
      });
    }

    // If no pitches, return warehouse as is
    return res.status(200).json(warehouse);
  } catch (err: any) {
    console.error("Error fetching warehouse and pitches:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateWarehouse = async (
  req: Request<{}, {}, UpdateWarehouseRequest>,
  res: Response<WarehouseResponse>
) => {
  const { login_id, id } = req.body;

  const {
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
  } = req.body;

  try {
    // Check if warehouse exists
    const existing = await pool.query(
      `SELECT * FROM warehouse WHERE login_id = $1 AND id = $2`,
      [login_id, id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "You are not authorize to edit the warehouse details.",
      });
    }

    // Update warehouse
    const result = await pool.query(
      `UPDATE warehouse
       SET warehouse_location = $1,
           warehouse_size = $2,
           warehouse_compliance = $3,
           material_details = $4
       WHERE login_id = $5 AND id = $6
       RETURNING *`,
      [
        warehouse_location,
        warehouse_size,
        JSON.stringify(warehouse_compliance || {}),
        JSON.stringify(material_details || {}),
        login_id,
        id,
      ]
    );

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error updating warehouse:", err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteWarehouse = async (
  req: Request<{}, {}, DeleteWarehouseRequest>,
  res: Response<{ message: string; id: string }>
) => {
  const { login_id, id } = req.body;

  if (!id || !login_id) {
    return res.status(400).json({
      error: "Warehouse ID and Login ID are required",
    });
  }

  try {
    // 🔍 Fetch warehouse first
    const existing = await pool.query(
      `SELECT id, login_id 
       FROM warehouse 
       WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "Warehouse not found",
      });
    }

    const warehouse = existing.rows[0];

    // 🔒 Ownership check
    if (Number(warehouse.login_id) !== Number(login_id)) {
      return res.status(403).json({
        error: "You are not allowed to delete this warehouse",
      });
    }

    // 🗑️ Delete
    await pool.query(`DELETE FROM warehouse WHERE id = $1`, [id]);

    return res.status(200).json({
      message: "Warehouse deleted successfully",
      id,
    });
  } catch (err: any) {
    console.error("Delete warehouse error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};



export const getWarehousesLocationByUser = async (
  req: Request,
  res: Response
) => {
  const { login_id } = req.params;

  if (!login_id || isNaN(Number(login_id))) {
    return res
      .status(400)
      .json({ error: "'login_id' is required and must be numeric" });
  }

  const companyId = Number(login_id);

  try {
    const result = await pool.query(
      `
      SELECT DISTINCT ON (warehouse_location->>'display_name')
        warehouse_location->>'display_name' AS display_name,
        warehouse_location
      FROM warehouse
      WHERE login_id = $1
        AND warehouse_location IS NOT NULL
      ORDER BY warehouse_location->>'display_name'
      `,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No warehouse locations found for this company",
      });
    }

    const locations = result.rows.map((row) => ({
      display_name: row.display_name,
      ...row.warehouse_location,
    }));

    return res.status(200).json({
      company_id: companyId,
      locations,
    });
  } catch (err: any) {
    console.error("Error fetching warehouse locations:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
};


export const getAllWarehousesThreePlList = async (
  req: Request<
    {},
    {},
    {},
    { login_id?: string; company_id?: string; location?: string }
  >,
  res: Response<{ warehouses: WarehouseResponse[] }>
) => {
  const { login_id, company_id, location } = req.query;

  // 🔹 FIX: Filter out "null" strings and undefined
  const cleanLoginId = login_id && login_id !== "null" ? login_id : undefined;
  const cleanCompanyId = company_id && company_id !== "null" ? company_id : undefined;
  const cleanLocation = location && location !== "null" ? location : undefined;

  console.log("=============================================", cleanLoginId, cleanCompanyId, cleanLocation )
  
  try {
    let query = `SELECT * FROM warehouse`;
    const values: any[] = [];
    const conditions: string[] = [];

    /**
     * 🔹 Handle company_id (cid) first - return ALL data for this company
     */
    if (cleanCompanyId) {
      conditions.push(`login_id = $${values.length + 1}`);
      values.push(cleanCompanyId);
      console.log("🏢 Using company_id filter - returning ALL warehouses for this company");
    }
    /**
     * 🔹 Handle identical login_id == company_id case
     */
    else if (cleanLoginId && cleanCompanyId && cleanLoginId === cleanCompanyId) {
      conditions.push(`login_id = $${values.length + 1}`);
      values.push(cleanLoginId);
      console.log("🎯 Using single login_id filter (login_id == company_id)");
    } else {
      /**
       * 🔹 3PL filtering logic (fallback)
       */
      if (cleanLoginId) {
        conditions.push(`
          login_id = $${values.length + 1} 
          OR company_details::text NOT ILIKE '%threepl%'
        `);
        values.push(cleanLoginId);
      } else {
        conditions.push(`company_details::text NOT ILIKE '%threepl%'`);
      }
    }

    /**
     * 🔹 Location filter (if provided)
     */
    if (cleanLocation) {
      conditions.push(
        `warehouse_location->>'display_name' = $${values.length + 1}`
      );
      values.push(cleanLocation);
    }

    /**
     * 🔹 Apply conditions
     */
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY id DESC`;

    console.log("🔍 Query:", query);
    console.log("📊 Values:", values);

    const result = await pool.query(query, values);

    return res.status(200).json({
      warehouses: result.rows,
    });
  } catch (err: any) {
    console.error("Error fetching warehouses:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
};

export const getWarehouseCompanyList = async (req, res) => {
  try {
    const rawLoginId = req.user?.login_id || req.user?.id;
    const login_id = rawLoginId != null ? String(rawLoginId) : null;

    if (!login_id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Fetch user's company details safely
    const userCompanyQuery = await pool.query(
      `SELECT company_details FROM warehouse WHERE login_id::text = $1 LIMIT 1`,
      [login_id]
    );

    const rawCompanyDetails = userCompanyQuery.rows[0]?.company_details ?? '';
    const companyDetailsStr = typeof rawCompanyDetails === 'string'
      ? rawCompanyDetails
      : JSON.stringify(rawCompanyDetails); // handle JSON objects
    const isUser3PLCompany = companyDetailsStr.toLowerCase().includes('threepl');

    // Build main query
    let query = `
      SELECT DISTINCT login_id, company_details
      FROM warehouse
      WHERE login_id IS NOT NULL
    `;
    const queryParams = [];

    if (isUser3PLCompany) {
      // Include user's own 3PL company + exclude other 3PLs
      query += ` AND (login_id::text = $1 OR company_details::text NOT ILIKE '%threepl%')`;
      queryParams.push(login_id);
    }

    query += ` ORDER BY company_details ASC`;

    const result = await pool.query(query, queryParams);
    let rows = result.rows;

    // Ensure user's company is included if they are 3PL
    if (isUser3PLCompany && !rows.some(r => String(r.login_id) === login_id)) {
      rows.unshift({ login_id, company_details: rawCompanyDetails });
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: "No warehouse companies found" });
    }

    // Map response — ALWAYS same format with login_id + company_name
    const data = rows.map(row => {
      let companyDetailsObj;
      try {
        companyDetailsObj = typeof row.company_details === 'string'
          ? JSON.parse(row.company_details)
          : row.company_details;
      } catch {
        companyDetailsObj = {};
      }

      return {
        login_id: row.login_id,
        company_name: companyDetailsObj.company_name || ''
      };
    });

    res.status(200).json(data);

  } catch (err) {
    console.error("Error fetching warehouse company list:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
};






