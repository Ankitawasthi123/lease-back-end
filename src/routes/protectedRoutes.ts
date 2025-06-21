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

router.post("/company/createRequirement", createRequirement);
router.post("/company/updaterequirments", updateCompanyRequirements);
router.post("/company/deleterequirments", deleteCompanyRequirements);
router.post("/company/requirement", getCurrRequirment);
router.post("/company/company-requirements-list", getCompanyRequirementsList);
router.get("/company/company-list", getCompanyList);
router.post("/company/requirment-details", getRequirementDetails);

export default router;
