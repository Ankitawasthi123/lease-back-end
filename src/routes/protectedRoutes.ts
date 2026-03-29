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
  threePlRequirements,
  getCompanyList,
  getRequirementDetails,
  getLocationListLocationsByUser,
  liveBids,
} from "../controllers/companyRequirementsController";
import {
  createBid,
  getBidsForUserAndCompany,
  getBidsCompanyList,
  deleteBid,
} from "../controllers/bidsController";
import {
  createWarehouse,
  getAllWarehousesList,
  getAllWarehousesThreePlList,
  getWarehousesCurrUser,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseCompanyList,
  getWarehousesLocationByUser,
} from "../controllers/warehouseController";
import {
  createRetail,
  getAllRetailsByLocation,
  getAllRetailsByCompany,
  getRetailsCurrUser,
  getRetailById,
  updateRetail,
  deleteRetail,
  getRetailCompanyList,
  getUserRetailsLocation,
} from "../controllers/retailController";
import {
  createPitch,
  getPitchById,
  getPitchByLoginAndWarehouseId,
  updatePitch,
  getPitchesForUser,
  getWarehouseRequirementCompanyList,
  deletePitch,
} from "../controllers/pitchesController";
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
  getRetailPitchCompanyList,
} from "../controllers/retailPitchesController";
import { createPayment, getPaymentsByUser } from "../controllers/paymentController";
import { minifyUploadedImages } from "../middleware/imageCompression";

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
  getCompanyRequirementsList,
);
router.post(
  "/company/threepl-requirement-list",
  protect,
  threePlRequirements,
);
router.get("/company/live-bids/:login_id", protect, liveBids);

router.get("/company/company-list", protect, getCompanyList);
router.post("/company/requirment-details", protect, getRequirementDetails);
router.get(
  "/company/user-location-list/:login_id",
  protect,
  getLocationListLocationsByUser,
);


router.post("/bids/add-bid", protect, createBid);
router.post("/bids/get-bid-byid", protect, getBidsForUserAndCompany);
router.post("/bids/bid-company-list", protect, getBidsCompanyList);
router.delete("/bids/delete-bid/:bid_id", protect, deleteBid);

router.post("/warehouse/create-warehouse", protect, createWarehouse);
router.get("/warehouse/warehouse-list", protect, getAllWarehousesList);
router.get("/warehouse/warehouse-threepl-list", protect, getAllWarehousesThreePlList);
router.get("/warehouse/warehouse-user-list", protect, getWarehousesCurrUser);
router.get(
  "/warehouse/warehouse-details/:login_id/:id",
  protect,
  getWarehouseById,
);
router.get(
  "/warehouse/warehouse-company", 
  protect, 
  getWarehouseCompanyList, 
);
router.put("/warehouse/update", protect, updateWarehouse);
router.delete("/warehouse/delete", protect, deleteWarehouse);
router.get(
  "/warehouse/warehouse-user-locations/:login_id", // ✅ Add leading slash
  protect,
  getWarehousesLocationByUser,
);

router.post("/retail/create-retail", protect, createRetail);
router.get(
  "/retail/retail-list-location",
  protect,
  getAllRetailsByLocation
);
router.get(
  "/retail/retail-list-company",
  protect,
  getAllRetailsByCompany
);
router.get("/retail/retail-user-list", protect, getRetailsCurrUser);
router.get("/retail/retail-details/:login_id/:id", protect, getRetailById);
router.get("/retail/retail-company-list", protect, getRetailCompanyList);
router.get("/retail/retail-user-location", protect, getUserRetailsLocation);
router.put("/retail/update", protect, updateRetail);
router.delete("/retail/:retail_id/:login_id", deleteRetail);

router.post("/pitch/create-pitch", protect, cpUpload, minifyUploadedImages, createPitch);
router.put("/pitch/update-pitch", protect, cpUpload, minifyUploadedImages, updatePitch);
router.put("/pitch/pitch-list", protect, cpUpload, minifyUploadedImages, getPitchesForUser);
router.put("/pitch/delete", protect, cpUpload, minifyUploadedImages, deletePitch);
router.put(
  "/pitch/pitch-company-list",
  protect,
  cpUpload,
  minifyUploadedImages,
  getWarehouseRequirementCompanyList,
);
router.get(
  "/pitch/pitch-details/:login_id/:warehouse_id",
  protect,
  getPitchByLoginAndWarehouseId,
);
router.get("/pitch/:pitch_id", protect, getPitchById);

router.post("/retail-pitch/create-pitch", protect, cpUpload, minifyUploadedImages, createRetailPitch);
router.put("/retail-pitch/update-pitch", protect, cpUpload, minifyUploadedImages, updateRetailPitch);
router.get(
  "/retail-pitch/pitch-details/:login_id/:retail_id",
  protect,
  getRetailPitchByLoginAndRetailId,
);
router.post(
  "/retail-pitch/reatail-pitch-company-list",
  protect,
  cpUpload,
  minifyUploadedImages,
  getRetailPitchCompanyList,
);
router.get(
  "/retail-pitch/retail-pitch-list",
  protect,
  getRetailPitchesForUser,
);
router.get("/retail-pitch/:pitch_id", protect, getRetailPitchById);

router.post("/payment/create-payment", protect, createPayment);
router.post("/payment/create", protect, createPayment);
router.post("/create-payment", protect, createPayment);
router.get("/payment/user/:user_id", protect, getPaymentsByUser);

export default router;
