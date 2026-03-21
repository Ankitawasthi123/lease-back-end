import { Request, Response } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import config from "../config/env";
import { Payment } from "../models";

// Instantiate Razorpay client from env
const razorpay = new Razorpay({
  key_id: (process.env.RAZORPAY_KEY_ID as string) || (config as any).RAZORPAY_KEY_ID,
  key_secret: (process.env.RAZORPAY_KEY_SECRET as string) || (config as any).RAZORPAY_KEY_SECRET,
});

// POST /razorpay/order - create order for frontend checkout
export const createRazorpayOrder = async (req: Request, res: Response) => {
  // ensure credentials are present before attempting any API call
  const keyId = (process.env.RAZORPAY_KEY_ID as string) || (config as any).RAZORPAY_KEY_ID;
  const keySecret = (process.env.RAZORPAY_KEY_SECRET as string) || (config as any).RAZORPAY_KEY_SECRET;
  // debug logging
  if (!keyId || !keySecret) {
    console.error("Razorpay credentials not configured", { keyId, keySecret });
    return res.status(500).json({
      error: `ankit: Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.  ${keyId}, ${keySecret}`,
    });
  }

  try {
    /**
     * expected body:
     * {
     *   amount: number (in currency unit e.g. 100.50),
     *   currency?: string (default INR),
     *   receipt: string | number (your internal order id),
     *   notes?: object
     * }
     */
    let { amount, currency = "INR", receipt, notes } = req.body || {};

    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return res.status(400).json({ message: "amount is required" });
    }
    if (!receipt && receipt !== 0) {
      return res.status(400).json({ message: "receipt (order id) is required" });
    }

    // Razorpay expects amount in currency subunits (paise for INR)
    const amountInSubunits = Math.round(Number(amount) * 100);

    // notes must be an object; reject or coerce invalid values
    if (notes && typeof notes !== "object") {
      console.warn("Invalid notes field, converting to empty object", notes);
      notes = {};
    }

    const order = await razorpay.orders.create({
      amount: amountInSubunits,
      currency,
      receipt: String(receipt),
      notes: notes || {},
    });

    return res.status(200).json({
      success: true,
      order,
      key: (process.env.RAZORPAY_KEY_ID as string) || (config as any).RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error("Razorpay order create error:", err?.message || err);
    return res.status(500).json({ message: "Failed to create Razorpay order", error: err?.message || err });
  }
};

// POST /razorpay/verify - verify payment signature sent from frontend after payment
export const verifyRazorpaySignature = async (req: Request, res: Response) => {
  // also guard against missing credentials here since we perform HMAC calculation
  const keySecret = (process.env.RAZORPAY_KEY_SECRET as string) || (config as any).RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error("Razorpay credentials not configured");
    return res.status(500).json({ error: "Razorpay credentials not configured" });
  }

  try {
    /**
     * expected body:
     * {
     *   razorpay_order_id,
     *   razorpay_payment_id,
     *   razorpay_signature,
     *   user_id?: number,
     *   amount?: number,
     *   currency?: string
     * }
     */
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id, amount, currency = "INR" } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing razorpay verification fields" });
    }

    const key_secret = (process.env.RAZORPAY_KEY_SECRET as string) || (config as any).RAZORPAY_KEY_SECRET;

    const expected = crypto
      .createHmac("sha256", key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isAuthentic = expected === razorpay_signature;

    // Persist/Update Payment model
    try {
      const tokenUserId = (req.user as any)?.id ?? (req.user as any)?.login_id ?? (req.user as any)?.userId;
      const resolvedUserId = Number(user_id ?? tokenUserId);

      const normalizedStatus = isAuthentic ? "success" : "failed";
      const paidAtValue = isAuthentic ? new Date() : null;

      const existing = await Payment.findOne({ where: { order_id: String(razorpay_order_id).replace(/\D/g, "") } });

      if (existing) {
        await (existing as any).update({
          user_id: resolvedUserId || existing.get("user_id"),
          amount: amount ? Number(amount) : existing.get("amount"),
          currency,
          payment_method: "razorpay",
          payment_provider: "razorpay",
          provider_transaction_id: razorpay_payment_id,
          status: normalizedStatus,
          failure_reason: isAuthentic ? null : "signature_mismatch",
          paid_at: paidAtValue,
        });
      } else {
        await Payment.create({
          user_id: resolvedUserId || 0,
          order_id: String(razorpay_order_id).replace(/\D/g, ""),
          amount: amount ? Number(amount) : 0,
          currency,
          payment_method: "razorpay",
          payment_provider: "razorpay",
          provider_transaction_id: razorpay_payment_id,
          status: normalizedStatus,
          failure_reason: isAuthentic ? null : "signature_mismatch",
          paid_at: paidAtValue,
        } as any);
      }
    } catch (e) {
      console.error("Error saving payment after verify:", e);
    }

    return res.status(200).json({ success: isAuthentic });
  } catch (err: any) {
    console.error("Razorpay verify error:", err?.message || err);
    return res.status(500).json({ message: "Verification failed", error: err?.message || err });
  }
};

// POST /razorpay/webhook - webhook from Razorpay Dashboard
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET as string) || (config as any).RAZORPAY_WEBHOOK_SECRET;
    const signature = req.get("x-razorpay-signature") as string;

    const payload = JSON.stringify(req.body);

    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    const isAuthentic = signature === expected;

    if (!isAuthentic) {
      console.warn("Razorpay webhook signature mismatch");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = req.body?.event;

    // Minimal persistence: on payment.captured or order.paid mark success
    if (event === "payment.captured" || event === "order.paid") {
      const entity = req.body?.payload?.payment?.entity || req.body?.payload?.order?.entity;
      const orderId = entity?.order_id || entity?.id; // payment has order_id, order event has id
      const paymentId = entity?.id;
      const amount = entity?.amount ? Number(entity.amount) / 100 : undefined;
      try {
        const existing = await Payment.findOne({ where: { order_id: String(orderId).replace(/\D/g, "") } });
        if (existing) {
          await (existing as any).update({
            payment_method: "razorpay",
            payment_provider: "razorpay",
            provider_transaction_id: paymentId,
            amount: typeof amount === "number" ? amount : existing.get("amount"),
            status: "success",
            failure_reason: null,
            paid_at: new Date(),
          });
        }
      } catch (e) {
        console.error("Error updating payment on webhook:", e);
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (err: any) {
    console.error("Razorpay webhook error:", err?.message || err);
    return res.status(500).json({ message: "Webhook handling failed", error: err?.message || err });
  }
};
