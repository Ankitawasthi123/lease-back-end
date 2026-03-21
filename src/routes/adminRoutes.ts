import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";
import jwt from "jsonwebtoken";
import {
  getCompanyRequirementsList,
  getAllUsersList,
  getBidsForAdmin,
  getAllWarehousesList,
  getRetailListAdmin,
  getAllPitchesAdmin,
  getAllRetailPitches,
} from "../controllers/admin/adminListController";

import {
  updateCompanyRequirementStatus,
  updateWarehouseStatus,
  updatePitchStatus,
  updateRetailStatus,
  updateRetailPitchStatus,
  updateBidStatus,
  updateUserStatus,
} from "../controllers/admin/adminUpdateController";

import {
  deleteCompanyRequirement,
  deleteWarehouse,
  deletePitch,
  deleteRetail,
  deleteRetailPitch,
  deleteBid,
  deleteUser,
} from "../controllers/admin/adminDeleteController";
import { sendBroadcastNotification } from "../controllers/admin/adminNotificationController";
import { validate } from "../middleware/validate";
import { sendBroadcastNotificationSchema } from "../validators/notification";

import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "pdf_file") {
      cb(null, "uploads/pdf/");
    } else {
      cb(null, "uploads/images/");
    }
  },
  filename: (req, file, cb) => {
    const loginId = req.body.login_id || "login";
    const warehouseId = req.body.warehouse_id || "warehouse";
    const pitchId = req.body.id || "pitch";
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");

    const finalName = `${loginId}_${warehouseId}_${pitchId}_${base}${ext}`;
    cb(null, finalName);
  },
});
export const upload = multer({ storage });

export const cpUpload = upload.fields([
  { name: "images", maxCount: 7 },
  { name: "pdf_file", maxCount: 1 },
]);

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

router.get("/requirements", protect, getCompanyRequirementsList);
router.get("/user-list", protect, getAllUsersList);
router.get("/bid-list", protect, getBidsForAdmin);
router.get("/warehouse-list", protect, getAllWarehousesList);
router.get("/retail-list", protect, getRetailListAdmin);
router.get("/warehouse-pitches", protect, getAllPitchesAdmin);
router.get("/retail-pitches", protect, getAllRetailPitches);
router.put("/company-requirements/status", protect, updateCompanyRequirementStatus);
router.put("/warehouse/status", protect, updateWarehouseStatus);
router.put("/pitches/status", protect, updatePitchStatus);
router.put("/retails/status", protect, updateRetailStatus);
router.put("/retail-pitches/status", protect, updateRetailPitchStatus);
router.put("/bids/status", protect, updateBidStatus);
router.put("/users/status", protect, updateUserStatus);
router.post(
  "/notifications/broadcast",
  protect,
  validate(sendBroadcastNotificationSchema),
  sendBroadcastNotification
);

// DELETE ROUTES
router.delete("/company-requirements", protect, deleteCompanyRequirement);
router.delete("/warehouse", protect, deleteWarehouse);
router.delete("/pitches", protect, deletePitch);
router.delete("/retails", protect, deleteRetail);
router.delete("/retail-pitches", protect, deleteRetailPitch);
router.delete("/bids", protect, deleteBid);
router.delete("/users", protect, deleteUser);





export default router;
