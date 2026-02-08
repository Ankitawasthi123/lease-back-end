import { Request, Response } from "express";
import { protect } from "../../middleware/authMiddleware";
import pool from "../../config/db";

/* ================= DELETE COMPANY REQUIREMENT ================= */
export const deleteCompanyRequirement = async (req: Request, res: Response) => {
  try {
    const { login_id, requirement_id } = req.body;

    // 1️⃣ Validate inputs
    if (!login_id || !requirement_id) {
      return res.status(400).json({
        error: "login_id and requirement_id are required",
      });
    }

    // 2️⃣ Check user role
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { role } = userResult.rows[0];

    if (role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can delete requirements",
      });
    }

    // 3️⃣ Delete requirement
    const deleteResult = await pool.query(
      `DELETE FROM company_requirements WHERE id = $1 RETURNING *`,
      [requirement_id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({
        error: "Requirement not found",
      });
    }

    return res.status(200).json({
      message: "Requirement deleted successfully",
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 DELETE REQUIREMENT ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/* ================= DELETE WAREHOUSE ================= */
export const deleteWarehouse = async (req: Request, res: Response) => {
  try {
    const { login_id, warehouse_id } = req.body;

    // 1️⃣ Validate inputs
    if (!login_id || !warehouse_id) {
      return res.status(400).json({
        error: "login_id and warehouse_id are required",
      });
    }

    // 2️⃣ Check if user is admin
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { role } = userResult.rows[0];

    if (role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can delete warehouses",
      });
    }

    // 3️⃣ Delete warehouse
    const deleteResult = await pool.query(
      `DELETE FROM warehouse WHERE id = $1 RETURNING *`,
      [warehouse_id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Warehouse not found" });
    }

    return res.status(200).json({
      message: "Warehouse deleted successfully",
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 DELETE WAREHOUSE ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/* ================= DELETE PITCH ================= */
export const deletePitch = async (req: Request, res: Response) => {
  try {
    const { login_id, pitch_id } = req.body;

    // 1️⃣ Validate inputs
    if (!login_id || !pitch_id) {
      return res.status(400).json({
        error: "login_id and pitch_id are required",
      });
    }

    // 2️⃣ Check admin role
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can delete pitches",
      });
    }

    // 3️⃣ Delete pitch
    const deleteResult = await pool.query(
      `DELETE FROM pitches WHERE id = $1 RETURNING *`,
      [pitch_id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Pitch not found" });
    }

    return res.status(200).json({
      message: "Pitch deleted successfully",
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 DELETE PITCH ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/* ================= DELETE RETAIL ================= */
export const deleteRetail = async (req: Request, res: Response) => {
  try {
    const { login_id, retail_id } = req.body;

    // 1️⃣ Validate inputs
    if (!login_id || !retail_id) {
      return res.status(400).json({
        error: "login_id and retail_id are required",
      });
    }

    // 2️⃣ Check admin role
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can delete retail properties",
      });
    }

    // 3️⃣ Delete retail
    const deleteResult = await pool.query(
      `DELETE FROM retail WHERE id = $1 RETURNING *`,
      [retail_id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Retail property not found" });
    }

    return res.status(200).json({
      message: "Retail property deleted successfully",
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 DELETE RETAIL ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/* ================= DELETE RETAIL PITCH ================= */
export const deleteRetailPitch = async (req: Request, res: Response) => {
  try {
    const { login_id, retail_pitch_id } = req.body;

    // 1️⃣ Validate inputs
    if (!login_id || !retail_pitch_id) {
      return res.status(400).json({
        error: "login_id and retail_pitch_id are required",
      });
    }

    // 2️⃣ Check admin role
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can delete retail pitches",
      });
    }

    // 3️⃣ Delete retail pitch
    const deleteResult = await pool.query(
      `DELETE FROM retail_pitches WHERE id = $1 RETURNING *`,
      [retail_pitch_id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Retail pitch not found" });
    }

    return res.status(200).json({
      message: "Retail pitch deleted successfully",
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 DELETE RETAIL PITCH ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/* ================= DELETE BID ================= */
export const deleteBid = async (req: Request, res: Response) => {
  try {
    const { login_id, bid_id } = req.body;

    // 1️⃣ Validate inputs
    if (!login_id || !bid_id) {
      return res.status(400).json({
        error: "login_id and bid_id are required",
      });
    }

    // 2️⃣ Check admin role
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can delete bids",
      });
    }

    // 3️⃣ Delete bid
    const deleteResult = await pool.query(
      `DELETE FROM bids WHERE id = $1 RETURNING *`,
      [bid_id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Bid not found" });
    }

    return res.status(200).json({
      message: "Bid deleted successfully",
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 DELETE BID ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/* ================= DELETE USER ================= */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { login_id, user_id: target_user_id } = req.body;

    // 1️⃣ Validate inputs
    if (!login_id || !target_user_id) {
      return res.status(400).json({
        error: "login_id and target_user_id are required",
      });
    }

    // 2️⃣ Check if the logged-in user exists and is admin
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "Logged-in user not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can delete users",
      });
    }

    // 3️⃣ Check if the target user exists
    const targetResult = await pool.query(
      `SELECT id FROM users WHERE id = $1`,
      [target_user_id]
    );

    if (targetResult.rowCount === 0) {
      return res.status(404).json({ error: "Target user not found" });
    }

    // 4️⃣ Delete user
    const deleteResult = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING *`,
      [target_user_id]
    );

    return res.status(200).json({
      message: "User deleted successfully",
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 DELETE USER ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};