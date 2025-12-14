import { Router } from "express";

import {
  registerUser,
  loginUser,
  // logOutUser,
  resendOtp,
  verifyOtp,
  forgotPassword,
  getUserProfile,
  completeRegistration,
  sendOtpEmail,
  verifyEmailOtp,
} from "../controllers/authController";
import multer from 'multer';
import path from 'path';
import fs from 'fs';


// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.body.userId || 'unknown'; // fallback if not yet set
    const fieldName = file.fieldname; // 'visiting_card_file' or 'digital_signature_file'
    const ext = path.extname(file.originalname); // e.g. '.png'

    const filename = `${userId}-${fieldName}${ext}`;

    // Overwrite old file with same name
    const fullPath = path.join('uploads', filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath); // delete old one before saving new
    }

    cb(null, filename);
  },
});

export const upload = multer({ storage });

export const cpUpload = upload.fields([
  { name: 'visiting_card_file', maxCount: 1 },
  { name: 'digital_signature_file', maxCount: 1 },
]);
const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
// router.get("/logout", logOutUser);
router.post("/resend-otp", resendOtp);
router.post("/verifyotp", verifyOtp);
router.post("/forgot-password", forgotPassword);
router.post("/user-profile", getUserProfile);
router.post("/complete-profile", cpUpload, completeRegistration);
router.post("/send-email-otp", cpUpload, sendOtpEmail);
router.post("/verify-email-otp", verifyEmailOtp);



export default router;
