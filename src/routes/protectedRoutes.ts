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

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

router.post("/company/create-requirement", protect, createRequirement);
router.post("/company/update-requirments", protect, updateCompanyRequirements);
router.post("/company/delete-requirments", protect, deleteCompanyRequirements);
router.post("/company/requirement", protect, getCurrRequirment);
router.post("/company/company-requirements-list", protect, getCompanyRequirementsList);
router.get("/company/company-list", protect, getCompanyList);
router.post("/company/requirment-details", protect, getRequirementDetails);
router.post("/bids/add-bid", protect, createBid);

export default router;
