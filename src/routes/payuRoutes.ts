import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  handleRazorpayWebhook,
} from "../controllers/razorpayController";

// This route file exists for backwards compatibility.  The frontend
// may still be calling paths under `/payu/...` so we simply forward
// those requests to the Razorpay implementation.  Eventually the UI
// should be updated to hit `/razorpay/...` directly and this file can
// be removed.

const router = Router();

// legacy POST /payu/initiate -> createRazorpayOrder
// authentication removed so public clients can obtain orders
router.post("/payu/initiate", createRazorpayOrder);

// some front‑end versions expect /payment/initiate; keep them working too
router.post("/payment/initiate", createRazorpayOrder);

// legacy POST /payu/callback -> verify signature (frontend sends the
// razorpay fields here).  We also allow webhooks under the same
// path so that an externally-configured callback can continue to use
// `/payu/callback` if needed.
router.post("/payu/callback", verifyRazorpaySignature);

// optional: if you were relying on server->server notification you
// may call the webhook handler as well
router.post("/payu/webhook", handleRazorpayWebhook);

export default router;
