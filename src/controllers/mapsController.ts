import axios from "axios";
import { Request, Response } from "express";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Geocode address using OpenStreetMap (Nominatim)
 * Backend proxy (required by OSM policy)
 */
export async function geocodeAddress(req: Request, res: Response) {
  console.log("Geocode Address Request Received ================================", req.body);
  
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const response = await axios.get(NOMINATIM_URL, {
      params: {
        q: query,
        format: "json",
        addressdetails: 1,
        limit: 5,
      },
      headers: {
        // 🔴 REQUIRED by OSM policy
        "User-Agent": "WarehouseApp/1.0 (test@yourdomain.com)",
      },
      timeout: 8000,
    });

    // ✅ Only send the data array, not the full response object
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Nominatim Error:", error.response?.data || error.message);

    // ✅ Only send safe serializable info
    res.status(500).json({
      message: "Geocoding failed",
      error: error.response?.data || error.message,
    });
  }
}
