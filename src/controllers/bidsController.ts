import { Request, Response } from "express";
import pool from "../config/db";

export const createBid = async (req: Request, res: Response) => {
  try {
    const { bid_id, bid_details, bid_type, requirement_id, pl_details } = req.body;

    // Validate input
    if (!bid_details || typeof bid_details !== "object" || Object.keys(bid_details).length === 0) {
      return res.status(400).json({ message: "Missing or invalid bid_details" });
    }

    if (!bid_type || !requirement_id || !pl_details) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Prepare bid details as JSON string
    const bidDetailsJson = JSON.stringify(bid_details);

    // Define the query and values
    let query: string;
    let values: any[];

    if (bid_id) {
      // Update existing bid
      query = `
        UPDATE bids
        SET requirement_id = $1, pl_details = $2, bid_type = $3, bid_details = $4::jsonb
        WHERE id = $5
        RETURNING *;
      `;
      values = [requirement_id, pl_details, bid_type, bidDetailsJson, bid_id];
    } else {
      // Insert new bid
      query = `
        INSERT INTO bids (requirement_id, pl_details, bid_type, bid_details)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING *;
      `;
      values = [requirement_id, pl_details, bid_type, bidDetailsJson];
    }

    // Execute the query
    const result = await pool.query(query, values);

    // Return the response
    return res.status(200).json({
      message: bid_id ? "Bid updated successfully" : "Bid created successfully",
      bid: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error processing bid:", error.message || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};