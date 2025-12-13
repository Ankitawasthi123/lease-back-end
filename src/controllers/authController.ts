// authController.ts
import { Request, Response } from "express";
import sequelize from "../config/data-source";
import User from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { randomBytes, createHash } from "crypto";
import nodemailer from "nodemailer";
import multer from "multer";
import twilio from "twilio";
import { Pool } from "pg";

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

/* -------------------- Twilio -------------------- */
const client = twilio(
  process.env.TWILIO_SID as string,
  process.env.TWILIO_AUTH_TOKEN as string
);
export const sendMobileOtp = async (phone: string) => {
  try {
    // const verification = await client.verify.v2
    //   .services(process.env.TWILIO_VERIFY_SID as string)
    //   .verifications.create({
    //     to: phone.startsWith("+") ? phone : `+91${phone}`,
    //     channel: "sms",
    //   });
    // console.log("OTP sent successfully. SID:", verification.sid);
    // return verification.sid;
  } catch (error) {
    console.error("Twilio Verify OTP error:", error);
    throw error;
  }
};

const sendEmailOtp = async (email: string, otp: string) => {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn("SMTP configuration missing. Skipping email OTP.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Email Verification OTP",
    text: `Your OTP is ${otp}. It will expire in 2 minutes.`,
  });

  console.log("Email OTP sent to:", email);
};

/* -------------------- Multer -------------------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
export const upload = multer({ storage });

/* -------------------- OTP Helpers -------------------- */
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getOtpExpiry = (): Date => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 2);
  return expiry; // full date + time object
};

/* -------------------- REGISTER -------------------- */
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

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const emailOtp = generateOtp();
    const mobileOtp = generateOtp();
    const otpExpiry = getOtpExpiry(); // full Date object, 2 minutes ahead

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
      email_otp: emailOtp,
      mobile_otp: mobileOtp,
      otp_expires_at: otpExpiry,
      mbile_verified: false,
      email_verified: false,
    });

    // Send OTPs asynchronously
    sendEmailOtp(email, emailOtp);
    sendMobileOtp(contact_number, mobileOtp);

    // Schedule OTP cleanup after expiry
    const ttl = otpExpiry.getTime() - new Date().getTime(); // milliseconds until expiry
    setTimeout(async () => {
      try {
        await user.update({
          email_otp: null,
          mobile_otp: null,
          otp_expires_at: null,
        });
        console.log(`OTP cleared for user ${user.id}`);
      } catch (err) {
        console.error("Failed to clear OTPs:", err);
      }
    }, ttl);

    return res.status(201).json({
      message: "OTP sent to email and mobile",
      user_id: user.id,
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { user_id, email_otp, mobile_otp } = req.body;

  const user = await User.findByPk(user_id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.otp_expires_at < new Date()) {
    return res.status(400).json({ message: "OTP expired" });
  }

  if (user.email_otp !== email_otp || user.mobile_otp !== mobile_otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  user.mobile_verified = true;
  user.email_verified = true;
  user.email_otp = null;
  user.mobile_otp = null;
  user.otp_expires_at = null;

  await user.save();

  return res.json({ message: "Account verified successfully" });
};

export const completeRegistration = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      first_name = "",
      middle_name = "",
      last_name = "",
      designation,
      contact_number,
    } = req.body;

    // Parse JSON fields safely
    const company_info = JSON.parse(req.body.company_info || "{}");
    const registered_address = JSON.parse(req.body.registered_address || "{}");
    const communication_address = JSON.parse(
      req.body.communication_address || "{}"
    );
    const director_info = JSON.parse(req.body.director_info || "[]");
    const filler_info = JSON.parse(req.body.filler_info || "{}");

    // Extract uploaded files
    const visiting_card =
      req.files?.["visiting_card_file"]?.[0]?.filename || "";
    const digital_signature =
      req.files?.["digital_signature_file"]?.[0]?.filename || "";

    // Add file paths to filler info
    filler_info.visiting_card = visiting_card;
    filler_info.digital_signature = digital_signature;

    // SQL query with placeholders
    const query = `
      UPDATE users
      SET
        first_name = $1,
        middle_name = $2,
        last_name = $3,
        designation = $4,
        contact_number = $5,
        company_info = $6,
        registered_address = $7,
        director_info = $8,
        filler_info = $9,
        communication_address = $10
      WHERE id = $11
      RETURNING *;
    `;

    const values = [
      first_name,
      middle_name,
      last_name,
      designation,
      contact_number,
      company_info,
      registered_address,
      director_info,
      filler_info,
      communication_address,
      userId,
    ];

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

//LOGIN
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

// export async function sendOtp(req: Request, res: Response) {
//   const otp = randomBytes(3).toString("hex").toUpperCase();
//   const hashedOtp = createHash("sha256").update(otp).digest("hex");
//   const expiry = new Date(Date.now() + 10 * 60 * 1000);

//   await pool.query(
//     "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3",
//     [hashedOtp, expiry, req?.body?.email]
//   );

//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: "artistatcode@gmail.com",
//       pass: "kubx xjuc minz aayw",
//     },
//   });

//   await transporter.sendMail({
//     from: "artistatcode@gmail.com",
//     to: req?.body?.email,
//     subject: "Password Reset OTP",
//     text: `Your OTP is: ${otp}`,
//   });

//   res.json("OTP send to the mail please check.");
// }

// export async function verifyOtp(req: Request, res: Response) {
//   const hashedOtp = crypto
//     .createHash("sha256")
//     .update(req.body.otp)
//     .digest("hex");
//   const result = await pool.query(
//     "SELECT reset_token, reset_token_expiry FROM users WHERE email = $1",
//     [req.body.email]
//   );

//   const user = result.rows[0];
//   if (!user) throw new Error("User not found");
//   if (user.reset_token !== hashedOtp) throw new Error("Invalid OTP");
//   if (new Date() > new Date(user.reset_token_expiry))
//     throw new Error("OTP expired");

//   res.json("Otp verified successfully.");
// }

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
  const {userId} = req.body;;
  if (!userId) return res.status(400).json({ message: "User ID required" });

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { password, ...rest } = user.toJSON();

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
    console.error("Error in getUserProfile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const tryParseJSON = (value: any) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (err) {
    return value;
  }
};
