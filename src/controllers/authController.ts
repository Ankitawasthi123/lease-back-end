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

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "your_username",
  database: process.env.DB_NAME || "your_database",
  password: process.env.DB_PASSWORD || "your_password",
  port: 5432,
});

const JWT_SECRET = process.env.JWT_SECRET || "mysecret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your_refresh_jwt_secret";

// Sync the models with the database
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
  const { name, email, password, role } = req.body;
  const existingUser = await User.findOne({ where: { email } });

  if (existingUser) {
    return res
      .status(400)
      .json({ message: "User already exists with this email" });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save the created user in a variable
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    // Now you can return the user
    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Error creating user:", error);
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

    const { name, role } = user;
    return res.json({ name, email: user.email, role });
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

    // Generate new access token
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
  const otp = randomBytes(3).toString("hex").toUpperCase(); // 6-character OTP
  const hashedOtp = createHash("sha256").update(otp).digest("hex");
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store the hashed OTP in the database
  await pool.query(
    "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3",
    [hashedOtp, expiry, req?.body?.email]
  );

  // Set up your transporter with real SMTP credentials

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "artistatcode@gmail.com",
      pass: "kubx xjuc minz aayw", // NOT your Gmail password!
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

  // ✅ Basic input validation
  if (!newPassword || !email) {
    return res
      .status(400)
      .json({ message: "Email and new password are required." });
  }

  try {
    // ✅ Check if OTP was verified earlier (exists in DB)
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

    // ✅ Update password & clear OTP fields
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

export const getUserProfile = async(req: Request, res: Response) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await User.findByPk(payload.id, {
      attributes: ['name', 'email', 'role']
    });
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    res.json(user);
  } catch (err) {
    res.clearCookie('token');
    res.status(401).json({ message: 'Unauthorized' });
  }
};
