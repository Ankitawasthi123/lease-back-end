import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { protect } from "../middleware/authMiddleware";
import {
  awardManpowerBid,
  createManpowerBid,
  deleteManpowerBid,
  deleteManpowerRequirement,
  createManpowerRequirement,
  getManpowerLiveBidByRequirement,
  getManpowerLiveBids,
  getManpowerBids,
  getManpowerBidById,
  getManpowerRequirementById,
  getManpowerRequirements,
  getMyManpowerBid,
  updateManpowerBid,
  updateManpowerBidStatus,
  updateManpowerRequirementStatus,
} from "../controllers/manpowerController";

const manpowerUploadDir = path.join("uploads", "manpower");

if (!fs.existsSync(manpowerUploadDir)) {
  fs.mkdirSync(manpowerUploadDir, { recursive: true });
}

const sanitizeName = (value: string) =>
  path
    .basename(value, path.extname(value))
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, manpowerUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = sanitizeName(file.originalname) || "file";
    cb(null, `${file.fieldname}-${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const pdfFields = new Set([
      "supporting_pdf",
      "supporting_document",
      "requirement_supporting_pdf",
      "pdf_file",
      "company_profile",
      "company_profile_pdf",
      "company_profile_pdf_path",
    ]);
    const imageFields = new Set([
      "authorized_signatory",
      "authorized_signatory_path",
      "company_stamp",
      "company_stamp_path",
    ]);

    if (pdfFields.has(file.fieldname)) {
      return file.mimetype === "application/pdf"
        ? cb(null, true)
        : cb(new Error(`${file.fieldname} must be a PDF file`));
    }

    if (imageFields.has(file.fieldname)) {
      return file.mimetype.startsWith("image/")
        ? cb(null, true)
        : cb(new Error(`${file.fieldname} must be an image file`));
    }

    return cb(null, true);
  },
});

const manpowerFiles = upload.fields([
  { name: "supporting_pdf", maxCount: 1 },
  { name: "supporting_document", maxCount: 1 },
  { name: "requirement_supporting_pdf", maxCount: 1 },
  { name: "pdf_file", maxCount: 1 },
  { name: "company_profile", maxCount: 1 },
  { name: "company_profile_pdf", maxCount: 1 },
  { name: "company_profile_pdf_path", maxCount: 1 },
  { name: "client_list", maxCount: 1 },
  { name: "client_list_file", maxCount: 1 },
  { name: "client_list_path", maxCount: 1 },
  { name: "safety_certificate", maxCount: 1 },
  { name: "safety_certificate_file", maxCount: 1 },
  { name: "safety_certificate_path", maxCount: 1 },
  { name: "iso", maxCount: 1 },
  { name: "iso_file", maxCount: 1 },
  { name: "iso_path", maxCount: 1 },
  { name: "authorized_signatory", maxCount: 1 },
  { name: "authorized_signatory_path", maxCount: 1 },
  { name: "company_stamp", maxCount: 1 },
  { name: "company_stamp_path", maxCount: 1 },
]);

const router = Router();

router.post("/requirements", protect, manpowerFiles, createManpowerRequirement);
router.get("/requirements", protect, getManpowerRequirements);
router.put("/requirements/status", protect, updateManpowerRequirementStatus);
router.get("/requirements/:id", protect, getManpowerRequirementById);
router.delete("/requirements/:id", protect, deleteManpowerRequirement);
router.post("/requirements/:id/bids", protect, manpowerFiles, createManpowerBid);
router.get("/requirements/:id/my-bid", protect, getMyManpowerBid);
router.get("/bids", protect, getManpowerBids);
router.put("/bids/status", protect, updateManpowerBidStatus);
router.get("/bids/:bidId", protect, getManpowerBidById);
router.patch("/bids/:bidId", protect, manpowerFiles, updateManpowerBid);
router.delete("/bids/:bidId", protect, deleteManpowerBid);
router.get("/live-bids", protect, getManpowerLiveBids);
router.get("/live-bids/:requirementId", protect, getManpowerLiveBidByRequirement);
router.post("/requirements/:id/award/:bidId", protect, awardManpowerBid);

export default router;
