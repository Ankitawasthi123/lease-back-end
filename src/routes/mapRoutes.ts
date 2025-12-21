import { Router, Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import {
  geocodeAddress,
} from "../controllers/mapsController";

const router = Router();

router.post("/map/get-addresses", protect,     geocodeAddress);
export default router;  