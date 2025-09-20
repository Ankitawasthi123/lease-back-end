// authController.ts
import { Request, response, Response } from "express";
import sequelize from "../config/data-source";
import User from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { randomBytes, createHash } from "crypto";
import nodemailer from "nodemailer";
import { Pool } from "pg";
import multer from "multer";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
export const upload = multer({ storage });

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  database: process.env.DB_NAME || "demodb",
  password: process.env.DB_PASSWORD || "Ankit@123",
  port: 5432,
});

const JWT_SECRET = process.env.JWT_SECRET || "mysecret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your_refresh_jwt_secret";

sequelize
  .sync({ force: false })
  .then(() => {
    console.log("Database synced!");
  })
  .catch((error) => {
    console.error("Error syncing the database: ", error);
  });

// REGISTER
export const registerUser = async (req: Request, res: Response) => {
  const {
    role,
    first_name,
    middle_name,
    last_name,
    company_name,
    designation,
    email,
    contact_number,
    password,
  } = req.body;
  const existingUser = await User.findOne({ where: { email } });

  if (existingUser) {
    return res
      .status(400)
      .json({ message: "User already exists with this email" });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      role,
      first_name,
      middle_name,
      last_name,
      company_name,
      designation,
      email,
      contact_number,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Error creating user:", error);
  }
};

export const completeRegistration = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    // Parse JSON fields if they were sent as strings (common with multipart/form-data)
    const companyInfo = JSON.parse(req.body.companyInfo || "{}");
    const registeredAddress = JSON.parse(req.body.registeredAddress || "{}");
    const communicationAddress = JSON.parse(
      req.body.communicationAddress || "{}"
    );
    const directorInfo = JSON.parse(req.body.directorInfo || "[]");
    const fillerInfo = JSON.parse(req.body.fillerInfo || "{}");

    // Get file names safely
    const visitingCard = req.files?.["visiting_card_file"]?.[0]?.filename || "";
    const digitalSignature =
      req.files?.["digital_signature_file"]?.[0]?.filename || "";

    // Attach file info to filler data
    fillerInfo.visiting_card = visitingCard;
    fillerInfo.digital_signature = digitalSignature;

    // Prepare SQL query and values
    const query = `
      UPDATE users
      SET 
        company_info = $1,
        registered_address = $2,
        director_info = $3,
        filler_info = $4,
        communication_address = $5
      WHERE id = $6
      RETURNING *;
    `;

    const values = [
      companyInfo,
      registeredAddress,
      directorInfo,
      fillerInfo,
      communicationAddress,
      userId,
    ];

    // Execute the update
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error completing registration:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// LOGIN
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json(user);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const refreshToken = (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .json({ message: "Invalid or expired refresh token" });
    }

    const accessToken = jwt.sign({ id: decoded.id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ accessToken });
  });
};

export const logOutUser = async (req: Request, res: Response) => {
  res.clearCookie("token");
  res.send("Logged out");
};

export async function sendOtp(req: Request, res: Response) {
  const otp = randomBytes(3).toString("hex").toUpperCase();
  const hashedOtp = createHash("sha256").update(otp).digest("hex");
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3",
    [hashedOtp, expiry, req?.body?.email]
  );

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "artistatcode@gmail.com",
      pass: "kubx xjuc minz aayw",
    },
  });

  await transporter.sendMail({
    from: "artistatcode@gmail.com",
    to: req?.body?.email,
    subject: "Password Reset OTP",
    text: `Your OTP is: ${otp}`,
  });

  res.json("OTP send to the mail please check.");
}

export async function verifyOtp(req: Request, res: Response) {
  const hashedOtp = crypto
    .createHash("sha256")
    .update(req.body.otp)
    .digest("hex");
  const result = await pool.query(
    "SELECT reset_token, reset_token_expiry FROM users WHERE email = $1",
    [req.body.email]
  );

  const user = result.rows[0];
  if (!user) throw new Error("User not found");
  if (user.reset_token !== hashedOtp) throw new Error("Invalid OTP");
  if (new Date() > new Date(user.reset_token_expiry))
    throw new Error("OTP expired");

  res.json("Otp verified successfully.");
}

export async function resetPassword(req: Request, res: Response) {
  const { newPassword, email }: any = req.body;

  if (!newPassword || !email) {
    return res
      .status(400)
      .json({ message: "Email and new password are required." });
  }

  try {
    const result = await pool.query(
      "SELECT reset_token FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user || !user.reset_token) {
      return res.status(400).json({
        message: "OTP verification is required before resetting password.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE email = $2",
      [hashedPassword, email]
    );

    res.json({ message: "Your password has been reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

export const getUserProfile = async (req: Request, res: Response) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number };

    const user = await User.findByPk(
      req?.body?.userId ? req?.body?.userId : payload.id
    );
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { password, ...rest } = user.toJSON(); // remove password

    const fullUserProfile = {
      ...rest,
      company_info: tryParseJSON(user.company_info),
      registered_address: tryParseJSON(user.registered_address),
      communication_address: tryParseJSON(user.communication_address),
      director_info: tryParseJSON(user.director_info),
      filler_info: tryParseJSON(user.filler_info),
    };

    res.status(200).json(fullUserProfile);
  } catch (err) {
    res.clearCookie("token");
    console.error("Error in getUserProfile:", err);
    res.status(401).json({ message: "Unauthorized" });
  }
};

const tryParseJSON = (value: any) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (err) {
    return value;
  }
};
