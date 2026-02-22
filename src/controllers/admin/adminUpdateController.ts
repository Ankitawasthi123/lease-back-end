import { Request, Response } from "express";
import { protect } from "../../middleware/authMiddleware";
import pool from "../../config/db";

const normalizeReason = (reason?: string) => {
  return typeof reason === "string" && reason.trim() !== "" ? reason.trim() : null;
};

const shouldSetReason = (status: string) => {
  return status === "returned" || status === "rejected";
};

export const updateCompanyRequirementStatus = async (req: Request, res: Response) => {
  try {
    const { login_id, requirement_id, status, reason } = req.body;
    const normalizedReason = normalizeReason(reason);

    // 1️⃣ Validate inputs
    if (!login_id || !requirement_id || !status) {
      return res.status(400).json({
        error: "login_id, requirement_id, and status are required",
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
        error: "Only admin users can update requirement status",
      });
    }

    // 3️⃣ Update requirement status (and return_reason if applicable)
    let updateResult;
    if (shouldSetReason(status)) {
      updateResult = await pool.query(
        `
        UPDATE company_requirements
        SET status = $1,
            return_reason = $2,
            created_date = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [status, normalizedReason, requirement_id]
      );
    } else {
      updateResult = await pool.query(
        `
        UPDATE company_requirements
        SET status = $1,
            return_reason = NULL,
            created_date = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [status, requirement_id]
      );
    }

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        error: "Requirement not found",
      });
    }

    return res.status(200).json({
      message: "Status updated successfully",
      data: updateResult.rows[0],
    });

  } catch (error) {
    console.error("🔥 UPDATE STATUS ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateWarehouseStatus = async (req: Request, res: Response) => {
  try {
    const { login_id, warehouse_id, status, reason } = req.body;
    const normalizedReason = normalizeReason(reason);

    // ✅ Validate input
    if (!login_id || !warehouse_id || !status) {
      return res.status(400).json({
        error: "login_id, warehouse_id, and status are required",
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
        error: "Only admin users can update warehouse status",
      });
    }

    // 3️⃣ Update warehouse status (and return_reason if applicable)
    let updateResult;
    if (shouldSetReason(status)) {
      updateResult = await pool.query(
        `
        UPDATE warehouse
        SET status = $1,
            return_reason = $2,
            created_date = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [status, normalizedReason, warehouse_id]
      );
    } else {
      updateResult = await pool.query(
        `
        UPDATE warehouse
        SET status = $1,
            return_reason = NULL,
            created_date = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [status, warehouse_id]
      );
    }

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: "Warehouse not found" });
    }

    return res.status(200).json({
      message: "Warehouse status updated successfully",
      data: updateResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 UPDATE WAREHOUSE STATUS ERROR:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const updatePitchStatus = async (req: Request, res: Response) => {
  try {
    const { login_id, pitch_id, status, reason } = req.body;
    const normalizedReason = normalizeReason(reason);

    /* ================= VALIDATION ================= */

    if (!login_id || !pitch_id || !status) {
      return res.status(400).json({
        error: "login_id, pitch_id, and status are required",
      });
    }

    /* ================= ADMIN CHECK ================= */

    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id],
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can update pitch status",
      });
    }

    /* ================= UPDATE PITCH ================= */

    let updateResult;
    if (shouldSetReason(status)) {
      updateResult = await pool.query(
        `
        UPDATE pitches
        SET status = $1,
            return_reason = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [status, normalizedReason, pitch_id],
      );
    } else {
      updateResult = await pool.query(
        `
        UPDATE pitches
        SET status = $1,
            return_reason = NULL,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [status, pitch_id],
      );
    }

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: "Pitch not found" });
    }

    return res.status(200).json({
      message: "Pitch status updated successfully",
      data: updateResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 UPDATE PITCH STATUS ERROR:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const updateRetailStatus = async (req: Request, res: Response) => {
  try {
    const { login_id, retail_id, status, reason } = req.body;
    const normalizedReason = normalizeReason(reason);

    if (!login_id || !retail_id || !status) {
      return res.status(400).json({
        error: "login_id, retail_id, and status are required",
      });
    }

    // Check admin
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id],
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can update retail status",
      });
    }

    // Update retail status (and return_reason if applicable)
    let updateResult;
    if (shouldSetReason(status)) {
      updateResult = await pool.query(
        `
        UPDATE retail
        SET status = $1,
            return_reason = $2,
            created_date = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [status, normalizedReason, retail_id]
      );
    } else {
      updateResult = await pool.query(
        `
        UPDATE retail
        SET status = $1,
            return_reason = NULL,
            created_date = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [status, retail_id],
      );
    }

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: "Retail not found" });
    }

    return res.status(200).json({
      message: "Retail status updated successfully",
      data: updateResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 UPDATE RETAIL STATUS ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateRetailPitchStatus = async (req: Request, res: Response) => {
  try {
    const { login_id, retail_pitch_id, status, reason } = req.body;
    const normalizedReason = normalizeReason(reason);
    if (!login_id || !retail_pitch_id || !status) {
      return res.status(400).json({
        error: "login_id, retail_pitch_id, and status are required",
      });
    }

    // Check if user exists and is admin
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can update retail pitch status",
      });
    }

    // Update retail pitch status (and return_reason if applicable)
    let updateResult;
    if (shouldSetReason(status)) {
      updateResult = await pool.query(
        `
        UPDATE retail_pitches
        SET status = $1,
            return_reason = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [status, normalizedReason, retail_pitch_id]
      );
    } else {
      updateResult = await pool.query(
        `
        UPDATE retail_pitches
        SET status = $1,
            return_reason = NULL,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [status, retail_pitch_id]
      );
    }

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: "Retail pitch not found" });
    }

    return res.status(200).json({
      message: "Retail pitch status updated successfully",
      data: updateResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 UPDATE RETAIL PITCH STATUS ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateBidStatus = async (req: Request, res: Response) => {
  try {
    const { login_id, bid_id, status, reason } = req.body;
    const normalizedReason = normalizeReason(reason);

    // ✅ Validate input
    if (!login_id || !bid_id || !status) {
      return res.status(400).json({
        error: "login_id, bid_id, and status are required",
      });
    }

    // ✅ Check if user exists and is admin
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can update bid status",
      });
    }

    // ✅ Update bid status (and return_reason if applicable)
    let updateResult;
    if (shouldSetReason(status)) {
      updateResult = await pool.query(
        `
        UPDATE bids
        SET status = $1,
            return_reason = $2,
            created_date = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [status, normalizedReason, bid_id]
      );
    } else {
      updateResult = await pool.query(
        `
        UPDATE bids
        SET status = $1,
            return_reason = NULL,
            created_date = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [status, bid_id]
      );
    }

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: "Bid not found" });
    }

    return res.status(200).json({
      message: "Bid status updated successfully",
      data: updateResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 UPDATE BID STATUS ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { login_id, user_id: target_user_id, status } = req.body;

    // ✅ Validate input
    if (!login_id || !target_user_id || !status) {
      return res.status(400).json({
        error: "login_id, target_user_id, and status are required",
      });
    }

    // ✅ Check if the logged-in user exists
    const userResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [login_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "Logged-in user not found" });
    }

    // Only admin can update other users
    if (userResult.rows[0].role !== "admin") {
      return res.status(403).json({
        error: "Only admin users can update user status",
      });
    }

    // ✅ Check if the target user exists
    const targetResult = await pool.query(
      `SELECT id FROM users WHERE id = $1`,
      [target_user_id]
    );

    if (targetResult.rowCount === 0) {
      return res.status(404).json({ error: "Target user not found" });
    }

    // ✅ Update user status
    const updateResult = await pool.query(
      `
      UPDATE users
      SET status = $1,
          created_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, target_user_id]
    );

    return res.status(200).json({
      message: "User status updated successfully",
      data: updateResult.rows[0],
    });
  } catch (error: any) {
    console.error("🔥 UPDATE USER STATUS ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
