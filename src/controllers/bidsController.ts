import { Request, Response } from "express";
import pool from "../config/db";

export const createBid = async (req: Request, res: Response) => {
  try {
    const { bid_id, bid_details, bid_type, requirement_id, pl_details } =
      req.body;

    // Validate input
    if (
      !bid_details ||
      typeof bid_details !== "object" ||
      Object.keys(bid_details).length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Missing or invalid bid_details" });
    }

    if (!bid_type || !requirement_id || !pl_details) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Prepare JSON fields
    const bidDetailsJson = JSON.stringify(bid_details);
    let query: string;
    let values: any[];

    if (bid_id) {
      // Update existing bid
      query = `
        UPDATE bids
        SET requirement_id = $1, pl_details = $2, bid_type = $3, bid_details = $4
        WHERE id = $5
        RETURNING *;
      `;
      values = [requirement_id, pl_details, bid_type, bidDetailsJson, bid_id];
    } else {
      // Insert new bid
      query = `
        INSERT INTO bids (requirement_id, pl_details, bid_type, bid_details)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      values = [requirement_id, pl_details, bid_type, bidDetailsJson];
    }

    const result = await pool.query(query, values);

    return res.status(200).json({
      message: bid_id ? "Bid updated successfully" : "Bid created successfully",
      bid: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error processing bid:", error.message || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getBidsForUserAndCompany = async (req: Request, res: Response) => {
  try {
    const { login_id, company_id } = req.body;

    if (!login_id || !company_id) {
      return res
        .status(400)
        .json({ message: "login_id and company_id are required" });
    }

    const query = `
  SELECT
    b.*,
    cr.id AS requirement_id,
    cr.warehouse_compliance AS warehouse_compliance,
    cr.company_id AS company_id,
    cr.bid_details->>'company_name' AS company_name,
    cr.warehouse_location AS warehouse_location,
    cr.bid_details AS bid_details
  FROM bids b
  INNER JOIN company_requirements cr
    ON cr.id = b.requirement_id
  WHERE cr.company_id = $2
    AND (b.pl_details->>'id')::int = $1
  ORDER BY b.id ASC
`;

    const values = [login_id, company_id];

    const result = await pool.query(query, values);

    return res.status(200).json({
      bids: result.rows,
    });
  } catch (error: any) {
    console.error("Error fetching bids:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getBidsCompanyList = async (req, res) => {
  try {
    const { login_id } = req.body;

    if (!login_id) {
      return res.status(400).json({ message: "login_id is required" });
    }

    const result = await pool.query(
      `
      SELECT DISTINCT ON (cr.company_id)
        cr.company_id,
        cr.bid_details->>'company_name' AS company_name
      FROM bids b
      INNER JOIN company_requirements cr
        ON cr.id = b.requirement_id
      WHERE (b.pl_details->>'id')::int = $1
      ORDER BY cr.company_id, cr.bid_details->>'company_name' ASC
      `,
      [login_id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No companies found for this user" });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching company list:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
