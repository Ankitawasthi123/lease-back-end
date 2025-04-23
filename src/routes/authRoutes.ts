import { Router } from "express";
import {
  registerUser,
  loginUser,
  logOutUser,
  sendOtp,
  verifyOtp,
  resetPassword,
} from "../controllers/authController";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/logout", logOutUser);
router.post("/sendotp", sendOtp);
router.post("/verifyotp", verifyOtp);
router.post("/resetPassword", resetPassword);

export default router;
