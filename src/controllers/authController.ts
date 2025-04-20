// authController.ts
import { Request, Response } from "express";
import sequelize from "../config/data-source";
import User from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "mysecret";

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

    res.json("Logged in");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// LOGIN
export const logOutUser = async (req: Request, res: Response) => {
  res.clearCookie("token");
  res.send("Logged out");
};
