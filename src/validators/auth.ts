import { z } from 'zod';

// ── Reusable primitives ──────────────────────────────────────────────────────
const emailField = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .trim()
  .toLowerCase()
  .max(254);

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

const otpField = z
  .preprocess(
    (val) => val === '' ? undefined : val,
    z.string()
      .length(6, { message: 'OTP must be exactly 6 digits' })
      .regex(/^\d{6}$/, { message: 'OTP must contain only digits' })
  )
  .optional();

// ── POST /api/auth/register ──────────────────────────────────────────────────
export const registerSchema = z.object({
  body: z.object({
    role: z.string().min(1).max(50).trim(),
    first_name: z.string().min(1, 'First name required').max(100).trim(),
    middle_name: z.string().max(100).trim().optional().default(''),
    last_name: z.string().min(1, 'Last name required').max(100).trim(),
    company_name: z.string().min(1, 'Company name required').max(200).trim(),
    designation: z.string().min(1, 'Designation required').max(100).trim(),
    email: emailField,
    contact_number: z
      .string()
      .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number'),
    password: passwordField,
  }),
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
export const loginSchema = z.object({
  body: z.object({
    email: emailField,
    password: z.string().min(1, 'Password is required').max(128),
  }),
});

// ── POST /api/auth/verifyotp ─────────────────────────────────────────────────
export const verifyOtpSchema = z.object({
  body: z
    .object({
      user_id: z.preprocess(
        (val) => typeof val === 'string' ? Number(val) : val,
        z.number().int().positive('user_id must be a positive integer')
      ),
      email_otp: otpField.optional(),
      mobile_otp: otpField.optional(),
    })
    .refine((d) => d.email_otp || d.mobile_otp, {
      message: 'At least one OTP (email_otp or mobile_otp) is required',
    }),
});

// ── POST /api/auth/resend-otp ────────────────────────────────────────────────
export const resendOtpSchema = z.object({
  body: z.object({
    user_id: z.number().int().positive('user_id must be a positive integer'),
  }),
});

// ── POST /api/auth/forgot-password ──────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailField,
  }),
});

// ── POST /api/auth/send-email-otp ────────────────────────────────────────────
export const sendEmailOtpSchema = z.object({
  body: z.object({
    email: emailField,
  }),
});

// ── POST /api/auth/verify-email-otp ──────────────────────────────────────────
export const verifyEmailOtpSchema = z.object({
  body: z.object({
    userId: z.number().int().positive('userId must be a positive integer'),
    email_otp: otpField,
  }),
});
