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
  res: Response<WarehouseResponse>,
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
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getWarehousesCurrUser = async (
  req: Request<{ login_id: string }>,
  res: Response<{ warehouses: WarehouseResponse[] }>,
) => {
  const { login_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM warehouse WHERE login_id = $1 ORDER BY id DESC`,
      [login_id],
    );
    res.status(200).json({ warehouses: result.rows });
  } catch (err: any) {
    console.error(`Error fetching warehouses for login_id ${login_id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

export const getWarehouseById = async (
  req: Request<{ login_id: string; id: string }>,
  res: Response,
) => {
  const { login_id, id } = req.params;

  try {
    // 1️⃣ Fetch warehouse
    const warehouseResult = await pool.query(
      `SELECT * FROM warehouse WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (warehouseResult.rows.length === 0) {
      return res.status(404).json({ error: "Warehouse not found" });
    }

    const warehouse = warehouseResult.rows[0];

    // 2️⃣ Fetch user role
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { role } = userResult.rows[0];

    // 3️⃣ Build pitch query
    let pitchesResult = { rows: [] };

    // 🟢 Company → all pitches
    if (role === "company") {
      pitchesResult = await pool.query(
        `SELECT * FROM pitches WHERE warehouse_id = $1`,
        [id],
      );
    }

    // 🔵 ThreePL
    else if (role === "threepl") {
      pitchesResult = await pool.query(
        `
        SELECT p.*
        FROM pitches p
        JOIN warehouse w ON w.id = p.warehouse_id
        WHERE p.warehouse_id = $1
          AND (
            p.login_id = $2
            OR w.login_id = $2
          )
        `,
        [id, login_id],
      );
    }

    // 🟣 Owner / Agent
    else if (role === "owner" || role === "agent") {
      pitchesResult = await pool.query(
        `
        SELECT * FROM pitches
        WHERE warehouse_id = $1
          AND login_id = $2
        `,
        [id, login_id],
      );
    }

    // 4️⃣ Always return warehouse + pitches (even if empty)
    return res.status(200).json({
      ...warehouse,
      pitches: pitchesResult.rows ?? [],
    });

  } catch (err: any) {
    console.error("Error fetching warehouse:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateWarehouse = async (
  req: Request<{}, {}, UpdateWarehouseRequest>,
  res: Response<WarehouseResponse>,
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
      [login_id, id],
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
      ],
    );

    res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("Error updating warehouse:", err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteWarehouse = async (
  req: Request<{}, {}, DeleteWarehouseRequest>,
  res: Response<{ message: string; id: string }>,
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
      [id],
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
  res: Response,
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
      [companyId],
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
  res: Response<{ warehouses: any[] }>,
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
    let query = `SELECT * FROM warehouse`;
    const values: any[] = [];
    const conditions: string[] = [];

    /**
     * 🔹 CASE 1: First load → approved only
     */
    if (!cleanLoginId) {
      conditions.push(`LOWER(status) = 'approved'`);
    }

    /**
     * 🔹 CASE 2: login_id present BUT no company_id
     * → show ONLY approved requests
     */
    if (cleanLoginId && !cleanCompanyId) {
      conditions.push(`LOWER(status) = 'approved'`);
    }

    /**
     * 🔹 CASE 3: login_id + company_id present
     */
    if (cleanLoginId && cleanCompanyId) {
      values.push(cleanCompanyId, cleanLoginId);

      conditions.push(`
        (
          company_details->>'id' = $1
          AND
          (
            company_details->>'id' = $2
            OR LOWER(status) = 'approved'
          )
        )
      `);
    }

    /**
     * 🔹 Location filter
     */
    if (cleanLocation) {
      values.push(cleanLocation);
      conditions.push(
        `warehouse_location->>'display_name' = $${values.length}`
      );
    }

    /**
     * 🔹 Apply WHERE clause
     */
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY id DESC`;

    console.log("🔍 Final Query:", query);
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

    // 1️⃣ Fetch logged-in user's company_details
    const userCompanyQuery = await pool.query(
      `
      SELECT company_details
      FROM warehouse
      WHERE login_id::text = $1
      LIMIT 1
      `,
      [login_id]
    );

    let userCompanyDetails: any = {};
    if (userCompanyQuery.rows.length) {
      const rawDetails = userCompanyQuery.rows[0].company_details;
      try {
        userCompanyDetails =
          typeof rawDetails === "string" ? JSON.parse(rawDetails) : rawDetails;
      } catch {
        userCompanyDetails = {};
      }
    }

    const companyDetailId =
      userCompanyDetails?.id != null
        ? String(userCompanyDetails.id)
        : null;

    // 2️⃣ Build base query
    let query = `
      SELECT DISTINCT ON (login_id)
        login_id,
        company_details,
        status
      FROM warehouse
      WHERE login_id IS NOT NULL
    `;
    const queryParams: any[] = [];

    // 3️⃣ Apply rules
    if (companyDetailId && companyDetailId === login_id) {
      // ✅ Case 1: company id matches → return all warehouses
      // no extra filter
    } else {
      // ✅ Case 2 & 3: company id is null or does not match → return approved warehouses
      console.log("Fetching only approved warehouses because company id is null or doesn't match");
      query += `
        AND status = 'approved'
      `;
    }

    // 4️⃣ ORDER BY required for DISTINCT ON
    query += `
      ORDER BY login_id, company_details ASC
    `;

    // 5️⃣ Execute query
    const result = await pool.query(query, queryParams);
    const rows = result.rows;

    if (!rows.length) {
      return res.status(404).json({ message: "No warehouse companies found" });
    }

    // 6️⃣ Normalize response
    const data = rows.map((row) => {
      let companyDetailsObj: any = {};
      try {
        companyDetailsObj =
          typeof row.company_details === "string"
            ? JSON.parse(row.company_details)
            : row.company_details;
      } catch {}

      return {
        login_id: row.login_id,
        company_name: companyDetailsObj.company_name || "",
        status: row.status || "",
      };
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching warehouse company list:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
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
    let query = `SELECT * FROM warehouse`;
    const values: any[] = [];
    const conditions: string[] = [];

    /**
     * 🔹 Ownership + approval logic (STRING comparison)
     */
    if (cleanLoginId) {
      values.push(cleanLoginId);

      conditions.push(`
        (
          company_details->>'id' = $${values.length}
          OR
          (
            company_details->>'id' <> $${values.length}
            AND LOWER(status) = 'approved'
          )
        )
      `);
    }

    /**
     * 🔹 Location filter
     */
    if (cleanLocation) {
      values.push(cleanLocation);
      conditions.push(
        `warehouse_location->>'display_name' = $${values.length}`,
      );
    }

    /**
     * 🔹 Apply WHERE clause
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

