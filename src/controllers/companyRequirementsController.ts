import { Router, Request, Response, response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";
import User from "../models/User";

interface CompanyRequirement {
  company_id: string;
  bid_details: {
    company_name: string;
    company_id: string;
  };
}

// Create a new company entry
export const createRequirement = async (req, res) => {
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

  try {
    const result = await pool.query(
      `INSERT INTO company_requirements (
        warehouse_location,
        company_id,
        warehouse_size,
        warehouse_compliance,
        material_details,
        labour_details,
        office_expenses,
        transport,
        requirement_type,
        bid_details,
        distance,
        status,
        created_date
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()
      )
      RETURNING *`,
      [
        JSON.stringify(warehouse_location || {}),
        company_id,
        JSON.stringify(warehouse_size || {}),
        JSON.stringify(warehouse_compliance || {}),
        JSON.stringify(material_details || {}),
        JSON.stringify(labour_details || {}),
        JSON.stringify(office_expenses || {}),
        JSON.stringify(transport || []),
        requirement_type,
        JSON.stringify(bid_details || {}),
        JSON.stringify(distance || []),
        status || "submitted",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create Requirement Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateCompanyRequirements = async (req, res) => {
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
    return res
      .status(400)
      .json({ error: "Both id and company_id are required" });
  }

  try {
    const result = await pool.query(
      `UPDATE company_requirements
       SET
         warehouse_location = $1,
         warehouse_size = $2,
         warehouse_compliance = $3,
         material_details = $4,
         labour_details = $5,
         office_expenses = $6,
         transport = $7,
         requirement_type = $8,
         bid_details = $9,
         distance = $10
       WHERE id = $11 AND company_id = $12
       RETURNING *`,
      [
        warehouse_location,
        warehouse_size,
        JSON.stringify(warehouse_compliance || {}),
        JSON.stringify(material_details || {}),
        JSON.stringify(labour_details || {}),
        JSON.stringify(office_expenses || {}),
        JSON.stringify(transport || []),
        requirement_type,
        JSON.stringify(bid_details || {}),
        JSON.stringify(distance || []),
        id,
        company_id,
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No matching record found for this ID and company_id" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: err.message });
  }
};
export const getCurrRequirment = async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID is required" });
  }

  try {
    const companyIdParsed = parseInt(id, 10);

    if (isNaN(companyIdParsed)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const result = await pool.query(
      "SELECT * FROM company_requirements WHERE id = $1",
      [companyIdParsed]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No company requirements found for this company" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching company requirements:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompanyRequirementsList = async (req, res) => {
  const { company_id, login_id } = req.body;

  if (!company_id || !login_id) {
    return res
      .status(400)
      .json({ error: "Company ID and login ID are required" });
  }

  try {
    const companyIdParsed = parseInt(company_id, 10);
    const loginIdParsed = parseInt(login_id, 10);

    if (isNaN(companyIdParsed) || isNaN(loginIdParsed)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    // 🔹 Fetch user
    const user = await User.findByPk(loginIdParsed);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isAdmin = user.role === "admin";

    // 🔹 Build query
    let query = "SELECT * FROM company_requirements";
    const values: any[] = [];

    if (!isAdmin) {
      // ✅ Non-admin: only approved + company-specific
      query += " WHERE company_id = $1 AND status = 'approved'";
      values.push(companyIdParsed);
    }
    // ✅ Admin: no filter (gets all statuses)

    const requirementsResult = await pool.query(query, values);
    const requirements = requirementsResult.rows;

    // ✅ Return blank array if nothing found (no error)
    if (requirements.length === 0) {
      return res.status(200).json([]);
    }

    // 🔹 Attach bids
    const requirementIds = requirements.map(r => r.id);

    const bidsResult = await pool.query(
      "SELECT * FROM bids WHERE requirement_id = ANY($1::int[])",
      [requirementIds]
    );

    const bids = bidsResult.rows;

    const enrichedRequirements = requirements.map(req => ({
      ...req,
      bids: bids.filter(bid => bid.requirement_id === req.id),
    }));

    return res.status(200).json(enrichedRequirements);

  } catch (err) {
    console.error("Error fetching company requirements:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getCompanyList = async (req, res, next) => {
  try {
    const result = await pool.query<CompanyRequirement>(
      "SELECT * FROM company_requirements"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No companies found" });
    }

    res.status(200).json(
      result.rows
        .map((row) => ({
          company_id: row?.company_id,
          company_name: row?.bid_details?.company_name,
        }))
        .filter(
          (value, index, self) =>
            index ===
            self.findIndex(
              (t) =>
                t.company_id === value.company_id &&
                t.company_name === value.company_name
            )
        )
    );
  } catch (err) {
    console.error("Error fetching company data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getRequirementDetails = async (req: Request, res: Response) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, company_id, role } = req.body;
  if (!id || !company_id) {
    return res
      .status(400)
      .json({ error: "Both 'id' and 'company_id' are required" });
  }

  const requirementId = parseInt(id, 10);
  const companyId = parseInt(company_id, 10);
  if (isNaN(requirementId) || isNaN(companyId)) {
    return res
      .status(400)
      .json({ error: "'id' and 'company_id' must be numeric" });
  }

  try {
    // 1️⃣ Fetch base requirement
    let reqRes;

    if (role === "threepl") {
      // Just fetch the requirement by ID
      reqRes = await pool.query(
        `SELECT * FROM company_requirements WHERE id = $1`,
        [requirementId]
      );
    } else {
      // For other roles, also check company_id
      reqRes = await pool.query(
        `SELECT * FROM company_requirements WHERE id = $1 AND company_id = $2`,
        [requirementId, companyId]
      );
    }

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ message: "Requirement not found" });
    }
    const requirement = reqRes.rows[0];

    // 2️⃣ Fetch related bids
    const bidsRes = await pool.query(
      `SELECT * FROM bids WHERE requirement_id = $1`,
      [requirementId]
    );
    const bids = bidsRes.rows;

    // 3️⃣ Return enriched object
    return res.status(200).json({
      ...requirement,
      bids,
    });
  } catch (err) {
    console.error("Error fetching requirement details:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteCompanyRequirements = async (req, res) => {
  const { company_id, requirement_id } = req.body;
  if (!requirement_id || !company_id) {
    return res.status(400).json({
      error: "Requirement ID and login ID are required",
    });
  }

  try {
    const requirementIdParsed = parseInt(requirement_id, 10);
    const loginIdParsed = parseInt(company_id, 10);

    if (isNaN(requirementIdParsed) || isNaN(loginIdParsed)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    // ✅ Step 1: Fetch user and check role
    const userResult = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [loginIdParsed]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];
    const isAdmin = user.role === "admin";

    // ✅ Step 2: Fetch requirement
    const requirementResult = await pool.query(
      "SELECT id, status, company_id FROM company_requirements WHERE id = $1",
      [requirementIdParsed]
    );

    if (requirementResult.rows.length === 0) {
      return res.status(404).json({ error: "Requirement not found" });
    }

    const requirement = requirementResult.rows[0];

    // 🔒 Step 3: Check permissions for normal users
    if (!isAdmin) {
      if (Number(requirement.company_id) !== loginIdParsed) {
        return res
          .status(403)
          .json({ error: "You are not allowed to delete this requirement" });
      }

      if (requirement.status !== "submitted") {
        return res
          .status(400)
          .json({ error: "Only submitted requirements can be deleted" });
      }
    }

    // 🗑️ Step 4: Delete
    await pool.query("DELETE FROM company_requirements WHERE id = $1", [
      requirementIdParsed,
    ]);

    return res.status(200).json({
      message: "Requirement deleted successfully",
      requirement_id: requirementIdParsed,
    });
  } catch (err) {
    console.error("Delete requirement error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

