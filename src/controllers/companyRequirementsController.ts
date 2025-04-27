import { Router, Request, Response } from "express";
// import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";

// const JWT_SECRET = process.env.JWT_SECRET!;

// Create a new company entry
export const companyRequirments = async (req, res) => {
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

export const getCurrRequirments = async (req, res) => {
  const { company_id } = req.body;

  if (!company_id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  try {
    const companyIdParsed = parseInt(company_id, 10);

    if (isNaN(companyIdParsed)) {
      return res.status(400).json({ error: 'Invalid company ID format' });
    }

    const result = await pool.query(
      "SELECT id, warehouse_location FROM company_requirements WHERE company_id = $1",
      [companyIdParsed] 
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No company requirements found for this company" });
    }

    res.status(200).json(result.rows);

  } catch (err) {
    console.error("Error fetching company requirements:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

