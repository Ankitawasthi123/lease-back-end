import { Request, Response } from "express";
import pool from "../config/db";

export const createBid = async (req: Request, res: Response) => {
  try {
    const {
      bid_id,
      bid_details,
      bid_type,
      requirement_id,
      pl_details,
      status,
    } = req.body;

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

    const bidStatus = status || "PENDING";
    const bidDetailsJson = JSON.stringify(bid_details);

    let query: string;
    let values: any[];

    if (bid_id) {
      // ✅ UPDATE bid (also update created_date)
      query = `
        UPDATE bids
        SET
          requirement_id = $1,
          pl_details = $2,
          bid_type = $3,
          bid_details = $4,
          status = $5,
          created_date = NOW()
        WHERE id = $6
        RETURNING *;
      `;

      values = [
        requirement_id,
        pl_details,
        bid_type,
        bidDetailsJson,
        bidStatus,
        bid_id,
      ];
    } else {
      // ✅ CREATE bid
      query = `
        INSERT INTO bids (
          requirement_id,
          pl_details,
          bid_type,
          bid_details,
          status,
          created_date
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *;
      `;

      values = [
        requirement_id,
        pl_details,
        bid_type,
        bidDetailsJson,
        bidStatus,
      ];
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
        cr.warehouse_compliance,
        cr.company_id,
        cr.bid_details->>'company_name' AS company_name,
        cr.warehouse_location,
        cr.bid_details
      FROM bids b
      INNER JOIN company_requirements cr
        ON cr.id = b.requirement_id
      WHERE cr.company_id = $2
        AND (
          (b.pl_details->>'id')::int = $1
          OR b.status = 'approved'
        )
      ORDER BY b.id ASC
    `;

    const values = [login_id, company_id];
    const result = await pool.query(query, values);

    return res.status(200).json({
      bids: result.rows,
    });
  } catch (error) {
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

export const deleteBid = async (req: Request, res: Response) => {
  try {
    const { bid_id } = req.params;
    const loginId = (req as any).user?.id; // from auth middleware

    console.log("Deleting bid:", bid_id, "by user:", loginId);

    if (!bid_id) {
      return res.status(400).json({ message: "Bid ID is required" });
    }

    if (!loginId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    /**
     * Delete ONLY IF:
     * 1. pl_details->>'id' matches loginId
     * 2. status === 'submitted'
     */
    const query = `
      DELETE FROM bids
      WHERE id = $1
        AND pl_details->>'id' = $2::text
        AND LOWER(status) = 'submitted';
    `;

    const result = await pool.query(query, [bid_id, loginId]);

    if (result.rowCount === 0) {
      return res.status(403).json({
        message: "Bid not found or you are not allowed to delete this bid",
      });
    }

    // ✅ Only send success message
    return res.status(200).json({ message: "Bid deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting bid:", error.message || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


