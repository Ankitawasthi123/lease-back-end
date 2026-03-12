import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { createRazorpayOrder, verifyRazorpaySignature } from "../controllers/razorpayController";

const router = Router();

// Create Razorpay order (no authentication required)
router.post("/razorpay/order", createRazorpayOrder);

// Verify Razorpay signature from frontend after successful payment
// (doesn't strictly need auth since it's called from client)
router.post("/razorpay/verify", verifyRazorpaySignature);

export default router;
