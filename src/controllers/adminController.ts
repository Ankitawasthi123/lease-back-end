import { Router, Request, Response, response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";

export const getCompanyRequirementsList = async (req, res) => {
  try {
    // ✅ Read login_id and optional location from body
    const login_id = parseInt(req.query.login_id, 10);
    if (isNaN(login_id)) {
      return res.status(400).json({ error: "login_id must be a valid number" });
    }

    // 1️⃣ Fetch user role and company_id
    const userResult = await pool.query(
      `SELECT id, role, company_name FROM users WHERE id = $1`,
      [login_id],
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { role, company_id } = userResult.rows[0];
    const isAdmin = role === "admin";

    // 2️⃣ Build base query
    let query = `
      SELECT 
        cr.*,
        COALESCE(
          json_agg(b.*) FILTER (WHERE b.id IS NOT NULL),
          '[]'
        ) AS bids
      FROM company_requirements cr
      LEFT JOIN bids b 
        ON b.requirement_id = cr.id
      WHERE 1 = 1
    `;

    const values = [];
    let index = 1;

    // 3️⃣ If NOT admin, restrict to own company
    if (!isAdmin) {
      query += ` AND cr.company_id = $${index}`;
      values.push(company_id); // use company_id instead of login_id
      index++;
    }

    query += `
      GROUP BY cr.id
      ORDER BY cr.created_date DESC
    `;

    const { rows } = await pool.query(query, values);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("🔥 API ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getAllUsersList = async (req, res) => {
  try {
    // ✅ Read login_id from query params for GET
    const login_id = parseInt(req.query.login_id, 10);

    if (isNaN(login_id)) {
      return res.status(400).json({ error: "login_id must be a valid number" });
    }

    // 1️⃣ Check if user is admin
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id],
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // 2️⃣ Fetch all users
    const usersResult = await pool.query(`
      SELECT 
        id,
        first_name,
        email,
        role,
        company_name,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);

    return res.status(200).json(usersResult.rows);
  } catch (error) {
    console.error("🔥 API ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getBidsForAdmin = async (req: Request, res: Response) => {
  try {
    const login_id = parseInt(req.query.login_id as string, 10);

    if (!login_id) {
      return res.status(400).json({ message: "login_id is required" });
    }

    // 1️⃣ Check if user is admin (optional - remove if always allowed)
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id],
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const { role } = userResult.rows[0];

    // ✅ SIMPLE: All bids from bids table
    const result = await pool.query(
      `
      SELECT 
        *,
        COALESCE(
          bid_details->>'companyName',
          bid_details->'company'->>'name', 
          bid_details->>'company_name'
        ) AS company_name
      FROM bids 
      ORDER BY id DESC
    `,
      [],
    ); // No parameters needed

    return res.status(200).json({
      bids: result.rows,
      total: result.rows.length,
      isAdmin: role === "admin",
    });
  } catch (error) {
    console.error("Error fetching bids:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllWarehousesList = async (
  req: Request<{}, {}, {}, { login_id?: string }>,
  res: Response
) => {
  const { login_id } = req.query;

  const cleanLoginId =
    login_id && login_id !== "null" && login_id !== "undefined"
      ? Number(login_id)
      : null;

  if (!cleanLoginId) {
    return res.status(400).json({ error: "login_id is required" });
  }

  try {
    // Validate user exists
    const userResult = await pool.query(`SELECT id FROM users WHERE id = $1`, [
      cleanLoginId,
    ]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch all warehouses
    const result = await pool.query(`
      SELECT id, warehouse_location, status, created_date
      FROM warehouse
      ORDER BY id DESC
    `);

    // Get count by status
    const statusCount = await pool.query(`
      SELECT status AS status, COUNT(*) as count
      FROM warehouse
      GROUP BY status
    `);

    return res.status(200).json({
      warehouses: result.rows,
      total: result.rowCount,
      statusCount: statusCount.rows,
    });
  } catch (err: any) {
    console.error("Error fetching warehouses:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
};


export const getRetailListAdmin = async (req: Request, res: Response) => {
  const { login_id } = req.query;

  if (!login_id || isNaN(Number(login_id))) {
    return res
      .status(400)
      .json({ error: "loginId is required and must be numeric" });
  }

  try {
    // Step 1: Get user and role
    const userResult = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [Number(login_id)]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRole = userResult.rows[0].role;

    // Step 2: Build where clause
    const queryParams: any[] = [];
    let whereClause =
      "WHERE retail_details ? 'retail_location' AND retail_details->'retail_location' IS NOT NULL";

    if (userRole !== "admin") {
      whereClause += " AND login_id = $1";
      queryParams.push(Number(login_id));
    }

    // Step 3: Fetch unique retail locations using ROW_NUMBER
    const result = await pool.query(
      `
      SELECT *
      FROM (
        SELECT *,
               ROW_NUMBER() OVER (
                 PARTITION BY retail_details->'retail_location'->>'display_name'
                 ORDER BY retail_details->'retail_location'->>'display_name'
               ) AS rn
        FROM retail
        ${whereClause}
      ) t
      WHERE rn = 1
      `,
      queryParams
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No retail locations found" });
    }

    // Step 4: Map rows to include display_name, status, and full retail_location object
    const locations = result.rows.map((row) => {
      const retailLocation = row.retail_details?.retail_location || {};
      return {
        display_name: retailLocation.display_name || "",
        status: row.status,
        retail_location: retailLocation,
        ...row, // include all other columns
      };
    });

    return res.status(200).json({ locations });
  } catch (err: any) {
    console.error("Error fetching retail locations:", err);
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
};
