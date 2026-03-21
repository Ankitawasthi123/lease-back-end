import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { sendBroadcastNotification } from "../controllers/admin/adminNotificationController";
import { sendBroadcastNotificationSchema } from "../validators/notification";

const router = Router();

router.get("/notifications/broadcast", (_req, res) => {
  return res.status(405).json({
    message: "Method not allowed. Use POST /api/notifications/broadcast",
  });
});

router.post(
  "/notifications/broadcast",
  protect,
  validate(sendBroadcastNotificationSchema),
  sendBroadcastNotification
);

export default router;
