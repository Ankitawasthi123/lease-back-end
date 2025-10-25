import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import pool from "../config/db";
import jwt from "jsonwebtoken";
import {
  createRequirement,
  updateCompanyRequirements,
  deleteCompanyRequirements,
  getCurrRequirment,
  getCompanyRequirementsList,
  getCompanyList,
  getRequirementDetails,
} from "../controllers/companyRequirementsController";
import { createBid } from "../controllers/bidsController";
import {
  createWarehouse,
  getAllWarehouses,
  getWarehousesCurrUser,
  getWarehouseById,
  updateWarehouse,
} from "../controllers/warehouse";
import {
  createRetail,
  getAllRetails,
  getRetailsCurrUser,
  getRetailById,
  updateRetail,
} from "../controllers/retail";
import {
  createPitch,
  getPitchById,
  getPitchByLoginAndWarehouseId,
  updatePitch,
} from "../controllers/pitches";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  createRetailPitch,
  getAllRetailPitches,
  getRetailPitchesForUser,
  getRetailPitchById,
  getRetailPitchByLoginAndRetailId,
  updateRetailPitch,
} from "../controllers/retailPiches";

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

router.post("/company/create-requirement", protect, createRequirement);
router.post("/company/update-requirments", protect, updateCompanyRequirements);
router.post("/company/delete-requirments", protect, deleteCompanyRequirements);
router.post("/company/requirement", protect, getCurrRequirment);
router.post(
  "/company/company-requirements-list",
  protect,
  getCompanyRequirementsList
);
router.get("/company/company-list", protect, getCompanyList);
router.post("/company/requirment-details", protect, getRequirementDetails);
router.post("/bids/add-bid", protect, createBid);
router.post("/warehouse/create-warehouse", protect, createWarehouse);
router.get("/warehouse/warehouse-list", protect, getAllWarehouses);
router.get("/warehouse/warehouse-user-list", protect, getWarehousesCurrUser);
router.get(
  "/warehouse/warehouse-details/:login_id/:id",
  protect,
  getWarehouseById
);
router.put("/warehouse/update", protect, updateWarehouse);
router.post("/retail/create-retail", protect, createRetail);
router.get("/retail/retail-list", protect, getAllRetails);
router.get("/retail/retail-user-list", protect, getRetailsCurrUser);
router.get("/retail/retail-details/:login_id/:id", protect, getRetailById);
router.put("/retail/update", protect, updateRetail);

router.post("/pitch/create-pitch", protect, cpUpload, createPitch);
router.put("/pitch/update-pitch", protect, cpUpload, updatePitch);
router.get(
  "/pitch/pitch-details/:login_id/:warehouse_id",
  protect,
  getPitchByLoginAndWarehouseId
);
router.post("/retail-pitch/create-pitch", protect, cpUpload, createRetailPitch);
router.get("/retail-pitch/:pitch_id", protect, getRetailPitchById);
router.post("/retail-pitch/create-pitch", protect, cpUpload, createRetailPitch);
router.put("/retail-pitch/update-pitch", protect, cpUpload, updateRetailPitch);
router.get(
  "/retail-pitch/pitch-details/:login_id/:retail_id",
  protect,
  getRetailPitchByLoginAndRetailId
);
router.get("/pitch/:pitch_id", protect, getPitchById);

export default router;
