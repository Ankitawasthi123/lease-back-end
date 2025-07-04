import { Router, Request, Response, response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";

interface CompanyRequirement {
  company_id: string;
  company_details: {
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
        transport
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        warehouse_location,
        company_id,
        warehouse_size,
        warehouse_compliance,
        material_details,
        labour_details,
        office_expenses,
        transport,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const updateCompanyRequirements = async (req, res) => {
  const {
    id,
    company_id,
    warehouse_location,
    warehouse_size,
    warehouse_compliance,
    material_details,
    labour_details,
    office_expenses,
    transport,
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
         transport = $7
       WHERE id = $8 AND company_id = $9
       RETURNING *`,
      [
        warehouse_location,
        warehouse_size,
        warehouse_compliance,
        material_details,
        labour_details,
        office_expenses,
        transport,
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

export const deleteCompanyRequirements = async (req, res) => {
  const { id, company_id } = req.body;

  if (!id || !company_id) {
    return res
      .status(400)
      .json({ error: "Both id and company_id are required" });
  }

  try {
    const result = await pool.query(
      `DELETE FROM company_requirements
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No matching record found to delete" });
    }

    res.status(200).json({ message: "Record successfully deleted" });
  } catch (err) {
    console.error("Delete error:", err);
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
  const { company_id } = req.body;

  if (!company_id) {
    return res.status(400).json({ error: "Company ID is required" });
  }

  try {
    const companyIdParsed = parseInt(company_id, 10);

    if (isNaN(companyIdParsed)) {
      return res.status(400).json({ error: "Invalid Company ID format" });
    }

    const requiremnts = await pool.query(
      "SELECT * FROM company_requirements WHERE company_id = $1",
      [companyIdParsed]
    );

    if (requiremnts.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No requirements found for this company" });
    }

    // Fetch all bids related to these requirements
    const requirementIds = requiremnts?.rows?.map((req) => req.id).map(String);
    const bidsResult = await pool.query(
      "SELECT * FROM bids WHERE requirement_id = ANY($1::int[])",
      [requirementIds]
    );

    const bids = bidsResult.rows;

    // Map bids to each requirement
    const enrichedRequirements = requiremnts?.rows?.map((req) => {
      const matchingBids = bids.filter((bid) => bid.requirement_id === req.id);
      return {
        ...req,
        bids: matchingBids,
      };
    });

    res.status(200).json(enrichedRequirements);
  } catch (err) {
    console.error("Error fetching company requirements:", err);
    res.status(500).json({ error: "Internal Server Error" });
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
          company_name: row?.company_details?.company_name,
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

  const { id, company_id } = req.body;

  if (!id || !company_id) {
    return res.status(400).json({
      error: "Both 'id' and 'company_id' are required in the JSON body",
    });
  }

  const parsedId = parseInt(id, 10);
  const parsedCompanyId = parseInt(company_id, 10);

  if (isNaN(parsedId) || isNaN(parsedCompanyId)) {
    return res.status(400).json({
      error: "Invalid format: 'id' and 'company_id' must be numeric",
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM company_requirements WHERE id = $1 AND company_id = $2",
      [parsedId, parsedCompanyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No requirement found matching the provided id and company_id",
      });
    }

    return res.status(200).json(result.rows[0]); // return single object
  } catch (err) {
    console.error("Error fetching requirement:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
