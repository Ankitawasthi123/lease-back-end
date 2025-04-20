import { Router } from "express";
import { registerUser, loginUser, logOutUser } from "../controllers/authController";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/logout", logOutUser);

export default router;
