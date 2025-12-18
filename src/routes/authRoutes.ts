import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  registerUser,
  loginUser,
  logOutUser,
  resendOtp,
  verifyOtp,
  forgotPassword,
  getUserProfile,
  completeRegistration,
  sendOtpEmail,
  verifyEmailOtp,
} from "../controllers/authController";

// ---------------- Multer Configuration ----------------

// Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.body.userId || "unknown";
    const fieldName = file.fieldname;
    const ext = path.extname(file.originalname);
    const filename = `${userId}-${fieldName}${ext}`;

    const fullPath = path.join("uploads", filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath); // overwrite old file
    }

    cb(null, filename);
  },
});

const upload = multer({ storage });

// ---------------- Middleware ----------------

// Accept specific files: visiting_card_file, digital_signature_file, profile_image
export const cpUpload = (req, res, next) => {
  const fields = [
    { name: "visiting_card_file", maxCount: 1 },
    { name: "digital_signature_file", maxCount: 1 },
    { name: "profile_image", maxCount: 1 }, // added to prevent "Unexpected field"
  ];

  const uploader = upload.fields(fields);

  uploader(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer Error:", err);
      return res.status(400).json({ error: err.message });
    } else if (err) {
      console.error("Unknown Upload Error:", err);
      return res.status(500).json({ error: "File upload failed" });
    }
    next();
  });
};

// ---------------- Router ----------------
const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/logout", logOutUser);
router.post("/resend-otp", resendOtp);
router.post("/verifyotp", verifyOtp);
router.post("/forgot-password", forgotPassword);
router.post("/user-profile", getUserProfile);

// Routes with file uploads
router.post("/complete-profile", cpUpload, completeRegistration);
router.post("/send-email-otp", cpUpload, sendOtpEmail);

router.post("/verify-email-otp", verifyEmailOtp);

export default router;
