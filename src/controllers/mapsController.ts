const axios = require("axios");
import { Request, Response } from "express";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const ACCESS_TOKEN_URL = process.env.ACCESS_TOKEN_URL;
const REDIRECT_URI = process.env.REDIRECT_URI;

export async function getAccessToken() {
  const url = ACCESS_TOKEN_URL;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await axios.post(url, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data.access_token;
}

export async function geocodeAddress(req: Request, res: Response) {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ message: "Address is required" });
    }

    const token = await getAccessToken();

    const url = REDIRECT_URI;
    const response = await axios.get(url, {
      params: {
        address: query,
        access_token: token,
        itemCount: 10,
      },
    });

    console.log("Geocode Result:", response.data);
    res.json(response.data);
  } catch (err) {
    console.error("API Error:", err.response?.data || err.message);
    res.status(500).json({ message: "Geocoding failed", error: err.message });
  }
}

