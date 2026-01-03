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
export const sendMobileOtp = async (phone: string, otp: string) => {
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

export const getOtpExpiry = (minutesValid = 5): Date => {
  return new Date(Date.now() + minutesValid * 60 * 1000);
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

  // No OTP provided at all
  if (!email_otp && !mobile_otp) {
    return res.status(400).json({ message: "OTP is required" });
  }

  // Validate email OTP if provided
  if (email_otp && user.email_otp !== email_otp) {
    return res.status(400).json({ message: "Invalid email OTP" });
  }

  // Validate mobile OTP if provided
  if (mobile_otp && user.mobile_otp !== mobile_otp) {
    return res.status(400).json({ message: "Invalid mobile OTP" });
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
    console.log("RAW BODY:", req.body);
    console.log("RAW FILES:", req.files);

    /* ================= USER ID ================= */
    const rawUserId = req.body.userId ?? req.body.user_id;
    if (!rawUserId) {
      return res.status(400).json({ message: "userId is missing" });
    }

    const userId = Number(rawUserId);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    /* ================= BASIC FIELDS ================= */
    const first_name = req.body.first_name || "";
    const middle_name = req.body.middle_name || "";
    const last_name = req.body.last_name || "";
    const designation = req.body.designation || "";
    const contact_number = req.body.contact_number || "";

    /* ================= JSON FIELDS ================= */
    const company_info = JSON.parse(req.body.company_info || "{}");
    const registered_address = JSON.parse(req.body.registered_address || "{}");
    const communication_address = JSON.parse(req.body.communication_address || "{}");
    const director_info = JSON.parse(req.body.director_info || "[]");
    const incomingFillerInfo = JSON.parse(req.body.filler_info || "{}");

    /* ================= FILES ================= */
    const visitingCardBinary =
      req.files?.["visiting_card_file"]?.[0]?.filename;

    const digitalSignatureBinary =
      req.files?.["digital_signature_file"]?.[0]?.filename;

    const profileImageBinary =
      req.files?.["profile_image"]?.[0]?.filename;

    /* ================= FETCH EXISTING USER ================= */
    const userResult = await pool.query(
      "SELECT filler_info, profile_image FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingFillerInfo = userResult.rows[0].filler_info || {};
    const existingProfileImage = userResult.rows[0].profile_image;

    /* ================= MERGE FILLER INFO SAFELY ================= */
    const filler_info = {
      ...existingFillerInfo,
      ...incomingFillerInfo,
    };

    // ✅ visiting card
    if (visitingCardBinary) {
      filler_info.visiting_card = visitingCardBinary;
    } else if (incomingFillerInfo.visiting_card?.trim()) {
      filler_info.visiting_card = incomingFillerInfo.visiting_card;
    } else {
      filler_info.visiting_card = existingFillerInfo.visiting_card;
    }

    // ✅ digital signature
    if (digitalSignatureBinary) {
      filler_info.digital_signature = digitalSignatureBinary;
    } else if (incomingFillerInfo.digital_signature?.trim()) {
      filler_info.digital_signature = incomingFillerInfo.digital_signature;
    } else {
      filler_info.digital_signature = existingFillerInfo.digital_signature;
    }

    /* ================= BUILD QUERY ================= */
    let query = `
      UPDATE users SET
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
    `;

    const values: any[] = [
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
    ];

    // ✅ profile image (binary > name > keep existing)
    if (profileImageBinary) {
      query += `, profile_image = $${values.length + 1}`;
      values.push(profileImageBinary);
    } else if (req.body.profile_image?.trim()) {
      query += `, profile_image = $${values.length + 1}`;
      values.push(req.body.profile_image);
    } else {
      // keep existing → do nothing
    }

    query += ` WHERE id = $${values.length + 1} RETURNING *`;
    values.push(userId);

    const result = await pool.query(query, values);

    return res.status(200).json({
      message: "User updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error completing registration:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Ensure user_id is a number
    const user = await User.findByPk(Number(user_id));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If both already verified, do NOT resend
    if (user.email_verified && user.mobile_verified) {
      return res.status(400).json({
        message: "Email and mobile already verified",
      });
    }

    // Generate OTP expiry and ensure it's a Date
    let otpExpiry = getOtpExpiry();
    if (typeof otpExpiry === "string") {
      otpExpiry = new Date(otpExpiry);
    }

    if (!(otpExpiry instanceof Date) || isNaN(otpExpiry.getTime())) {
      console.error("Invalid OTP expiry returned:", otpExpiry);
      return res.status(500).json({ message: "Invalid OTP expiry" });
    }

    const updateData: Partial<typeof user> = {
      otp_expires_at: otpExpiry,
    };

    let emailSent = false;
    let mobileSent = false;

    /* --------------------
       Email OTP
    -------------------- */
    if (!user.email_verified) {
      const emailOtp = generateOtp();
      updateData.email_otp = emailOtp;

      try {
        await sendEmailOtp(user.email, emailOtp);
        emailSent = true;
      } catch (err) {
        console.error("Failed to send email OTP:", err);
      }
    }

    /* --------------------
       Mobile OTP
    -------------------- */
    if (!user.mobile_verified) {
      const mobileOtp = generateOtp();
      updateData.mobile_otp = mobileOtp;

      try {
        await sendMobileOtp(user.contact_number, mobileOtp);
        mobileSent = true;
      } catch (err) {
        console.error("Failed to send mobile OTP:", err);
      }
    }

    // Save OTPs & expiry in DB
    try {
      await user.update(updateData);
    } catch (err) {
      console.error("Failed to update user with OTP:", err);
      return res.status(500).json({ message: "Failed to update OTP" });
    }

    // Auto-clear OTP after expiry (only if expiry is in the future)
    const ttl = Math.max(0, otpExpiry.getTime() - Date.now());
    if (ttl > 0) {
      setTimeout(async () => {
        try {
          await user.update({
            email_otp: null,
            mobile_otp: null,
            otp_expires_at: null,
          });
        } catch (err) {
          console.error("Failed to clear OTP:", err);
        }
      }, ttl);
    }

    return res.status(200).json({
      message: "OTP resent successfully",
      email_sent: emailSent,
      mobile_sent: mobileSent,
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

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

    // Check if email and mobile are verified
    if (!user.email_verified || !user.mobile_verified) {
      return res.status(403).json({
        message:
          "Account not verified. Please verify your email and mobile first.",
        userId: user.id, // send userId so front-end can trigger OTP flow
        emailVerified: user.email_verified,
        mobileVerified: user.mobile_verified,
      });
    }

    // Both verified – issue token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    return res.json({
      message: "Login successful",
      user,
    });
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

export const getUserProfile = async (req: Request, res: Response) => {
  let userId: number | undefined;

  /* 1️⃣ PRIORITY: payload userId */
  if (req.body?.userId) {
    userId = Number(req.body.userId);
  }

  /* 2️⃣ FALLBACK: logged-in user from JWT */
  if (!userId) {
    const token = req.cookies?.token;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
        userId = decoded.id;
      } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
      }
    }
  }

  /* 3️⃣ Still no userId */
  if (!userId) {
    return res.status(400).json({ message: "User ID required" });
  }

  try {
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    /* ❌ remove sensitive fields */
    const {
      password,
      email_otp,
      mobile_otp,
      otp_expires_at,
      mobile_verified,
      email_verified,
      ...safeUser
    } = user.toJSON();

    /* ✅ parse JSON fields */
    const fullUserProfile = {
      ...safeUser,
      company_info: tryParseJSON(user.company_info),
      registered_address: tryParseJSON(user.registered_address),
      communication_address: tryParseJSON(user.communication_address),
      director_info: tryParseJSON(user.director_info),
      filler_info: tryParseJSON(user.filler_info),
    };

    return res.status(200).json(fullUserProfile);
  } catch (err) {
    console.error("Error in getUserProfile:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const tryParseJSON = (value: any) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (err) {
    return value;
  }
};

export const sendOtpEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // 1️⃣ Validate email
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // 2️⃣ Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3️⃣ Generate OTP + expiry
    const otp = generateOtp();
    const otpExpiry = getOtpExpiry(2); // 2 minutes

    // 4️⃣ Save OTP in DB
    await user.update({
      email_otp: otp,
      otp_expires_at: otpExpiry,
    });

    // 5️⃣ Send email OTP
    await sendEmailOtp(email, otp);

    // 6️⃣ Return safe user data
    const {
      password,
      email_otp,
      mobile_otp,
      ...safeUser
    } = user.toJSON();

    return res.status(200).json({
      message: "OTP sent to email successfully",
      user: safeUser,
      otp_expires_at: otpExpiry,
    });
  } catch (error) {
    console.error("sendOtpEmail error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


export const verifyEmailOtp = async (req: Request, res: Response) => {
  try {
    const { userId, email_otp, mobile_otp } = req.body;

    // 1️⃣ Validate input
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!email_otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    // 2️⃣ Find user by ID
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3️⃣ Check OTP expiry
    if (!user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // 4️⃣ Validate email OTP if provided
    if (email_otp && user.email_otp !== email_otp) {
      return res.status(400).json({ message: "Invalid email OTP" });
    }

    // 5️⃣ Validate mobile OTP if provided
    if (mobile_otp && user.mobile_otp !== mobile_otp) {
      return res.status(400).json({ message: "Invalid mobile OTP" });
    }

    // 6️⃣ Mark verified based on OTPs used
    if (email_otp) user.email_verified = true;
    if (mobile_otp) user.mobile_verified = true;

    // 7️⃣ Clear OTPs
    user.email_otp = null;
    user.mobile_otp = null;
    user.otp_expires_at = null;

    await user.save();

    return res.status(200).json({
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("verifyEmailOtp error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export async function forgotPassword(req: Request, res: Response) {
  const { newPassword, userId }: { newPassword: string; userId: number } = req.body;

  if (!newPassword || !userId) {
    return res
      .status(400)
      .json({ message: "User ID and new password are required." });
  }

  try {
    // 1️⃣ Check if user exists and has verified OTP
    const result = await pool.query(
      "SELECT reset_token FROM users WHERE id = $1",
      [userId]
    );

    const user = result.rows[0];

    // 2️⃣ Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3️⃣ Update password and clear OTP/reset_token
    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2",
      [hashedPassword, userId]
    );

    res.json({ message: "Your password has been reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
}
