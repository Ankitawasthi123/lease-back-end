import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";

interface CompanyRequirement {
  company_id: string;
  company_details: {
    company_name: string;
    company_id: string;
  };
}

export const createBid = async (req: Request, res: Response) => {
  try {
    const { bid_details, bid_type, requirement_id, pl_details } = req.body;

    // Global validations
    if (
      !bid_details ||
      typeof bid_details !== "object" ||
      Object.keys(bid_details).length === 0 ||
      !bid_type ||
      !requirement_id ||
      !pl_details
    ) {
      return res
        .status(400)
        .json({ message: "Missing or invalid required fields" });
    }

    if (bid_type === "regular") {
      const requiredFields = [
        "warehouse",
        "transportation",
        "manpower",
        "miscellaneous",
      ];
      const invalidFields = requiredFields.filter((field) => {
        const value = bid_details[field];
        // Reject empty string, null, undefined, or not positive numbers
        if (
          value === undefined ||
          value === null ||
          value === "" || // Reject empty strings
          isNaN(Number(value)) || // Reject non-numbers
          Number(value) <= 0 // Reject zero or negative numbers
        ) {
          return true; // invalid field
        }
        return false; // valid field
      });

      if (invalidFields.length > 0) {
        return res.status(400).json({
          message:
            "Invalid 'regular' bid: All fields (warehouse, transportation, manpower, miscellaneous) must be valid numbers greater than zero.",
          missingOrInvalidFields: invalidFields,
        });
      }
    }

    // Conditional validation for percent bid
    if (bid_type === "percent") {
      const { toatalCoasting, businessCoasintng, percentageCharged } =
        bid_details;

      if (
        toatalCoasting == null ||
        toatalCoasting <= 0 ||
        businessCoasintng == null ||
        businessCoasintng <= 0 ||
        percentageCharged == null ||
        percentageCharged <= 0
      ) {
        return res.status(400).json({
          message:
            "Invalid percent bid: All fields must be non-zero and present (toatalCoasting, businessCoasintng, percentageCharged)",
        });
      }
    }

    // Insert query
    const insertQuery = `
      INSERT INTO bids (
        requirement_id,
        pl_details,
        bid_type,
        bid_details
      ) VALUES ($1, $2, $3, $4::jsonb)
      RETURNING *;
    `;

    const values = [
      requirement_id,
      pl_details,
      bid_type,
      JSON.stringify(bid_details),
    ];

    const result = await pool.query(insertQuery, values);

    return res.status(201).json({
      message: "Bid created successfully",
      bid: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error creating bid:", error.message || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
