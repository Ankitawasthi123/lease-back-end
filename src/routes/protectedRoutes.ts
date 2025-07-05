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

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

router.post("/company/createRequirement", protect, createRequirement);
router.post("/company/updaterequirments", protect, updateCompanyRequirements);
router.post("/company/deleterequirments", protect, deleteCompanyRequirements);
router.post("/company/requirement", protect, getCurrRequirment);
router.post("/company/company-requirements-list", getCompanyRequirementsList);
router.get("/company/company-list", protect, getCompanyList);
router.post("/company/requirment-details", protect, getRequirementDetails);

export default router;
