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
  createPitch,
  getPitchById,
  getPitchByLoginAndWarehouseId,
  updatePitch,
} from "../controllers/pitches";

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
router.post("/pitch/create-pitch", protect, createPitch);
router.put("/pitch/update-pitch", protect, updatePitch);
router.get("/pitch/pitch-details/:login_id/:warehouse_id", protect, getPitchByLoginAndWarehouseId);


export default router;
