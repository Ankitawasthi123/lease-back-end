import { Request, Response } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { Op } from "sequelize";
import config from "../config/env";
import { Payment, User } from "../models";
import { sendPaymentInvoiceEmail } from "../utils/invoiceMailer";
import { ensurePaymentMetadataColumns } from "../utils/paymentSchema";

const toBigintOrderId = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  const digits = raw.match(/\d+/g)?.join("") || "";
  if (digits) {
    return digits;
  }

  // Keep a deterministic positive bigint when provider IDs contain no digits.
  const hex = crypto.createHash("sha256").update(raw || "fallback-order").digest("hex").slice(0, 15);
  return BigInt(`0x${hex}`).toString();
};

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
    await ensurePaymentMetadataColumns();

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
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user_id,
      plan,
      amount,
      currency = "INR",
      email,
      name,
    } = req.body || {};

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
    let resolvedUserId = 0;
    try {
      const tokenUserId = (req.user as any)?.id ?? (req.user as any)?.login_id ?? (req.user as any)?.userId;
      resolvedUserId = Number(user_id ?? tokenUserId);

      const normalizedStatus = isAuthentic ? "success" : "failed";
      const paidAtValue = isAuthentic ? new Date() : null;

      let orderDetails: any = null;
      try {
        orderDetails = await razorpay.orders.fetch(String(razorpay_order_id));
      } catch (fetchErr: any) {
        console.warn("Unable to fetch Razorpay order details:", fetchErr?.message || fetchErr);
      }

      const receiptOrOrderId = orderDetails?.receipt || razorpay_order_id;
      const normalizedOrderId = toBigintOrderId(receiptOrOrderId);

      const notesUserId = Number(orderDetails?.notes?.user_id || orderDetails?.notes?.login_id || 0);
      const resolvedPlan =
        typeof plan === "string" && plan.trim()
          ? plan.trim()
          : typeof orderDetails?.notes?.plan === "string" && orderDetails.notes.plan.trim()
            ? orderDetails.notes.plan.trim()
            : null;
      const finalUserId = resolvedUserId || notesUserId;
      const amountFromOrder =
        typeof orderDetails?.amount === "number" && !Number.isNaN(orderDetails.amount)
          ? Number(orderDetails.amount) / 100
          : undefined;

      const existing = await Payment.findOne({
        where: {
          [Op.or]: [
            { order_id: normalizedOrderId },
            { provider_transaction_id: String(razorpay_payment_id) },
          ],
        },
        order: [["created_at", "DESC"]],
      });

      let savedPayment: any;
      if (existing) {
        await (existing as any).update({
          user_id: finalUserId || existing.get("user_id"),
          order_id: normalizedOrderId,
          amount:
            amount !== undefined && amount !== null
              ? Number(amount)
              : typeof amountFromOrder === "number"
                ? amountFromOrder
                : existing.get("amount"),
          currency,
          payment_method: "razorpay",
          payment_provider: "razorpay",
          provider_transaction_id: razorpay_payment_id,
          status: normalizedStatus,
          failure_reason: isAuthentic ? null : "signature_mismatch",
          paid_at: paidAtValue,
          plan: resolvedPlan,
          billing_email: typeof email === "string" ? email.trim().toLowerCase() : existing.get("billing_email"),
          gateway_order_id: String(razorpay_order_id),
          gateway_payment_id: String(razorpay_payment_id),
          gateway_signature: String(razorpay_signature),
          callback_payload: req.body || null,
          invoice_email_sent: false,
          invoice_email_error: null,
          invoice_sent_at: null,
        });
        savedPayment = existing;
      } else {
        savedPayment = await Payment.create({
          user_id: finalUserId || 0,
          order_id: normalizedOrderId,
          amount:
            amount !== undefined && amount !== null
              ? Number(amount)
              : typeof amountFromOrder === "number"
                ? amountFromOrder
                : 0,
          currency,
          payment_method: "razorpay",
          payment_provider: "razorpay",
          provider_transaction_id: razorpay_payment_id,
          status: normalizedStatus,
          failure_reason: isAuthentic ? null : "signature_mismatch",
          paid_at: paidAtValue,
          plan: resolvedPlan,
          billing_email: typeof email === "string" ? email.trim().toLowerCase() : null,
          gateway_order_id: String(razorpay_order_id),
          gateway_payment_id: String(razorpay_payment_id),
          gateway_signature: String(razorpay_signature),
          callback_payload: req.body || null,
          invoice_email_sent: false,
          invoice_email_error: null,
          invoice_sent_at: null,
        } as any);
      }

      if (isAuthentic) {
        try {
          let billingEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : "";
          let gstNumber: string | null = null;
          if (resolvedUserId) {
            const user = await User.findByPk(resolvedUserId);
            if (!billingEmail) {
              const userEmail = (user as any)?.email;
              billingEmail = typeof userEmail === "string" ? userEmail.trim().toLowerCase() : "";
            }
            const companyInfo: any = (user as any)?.company_info || {};
            gstNumber = companyInfo?.gst_number || companyInfo?.gstin || companyInfo?.gst || null;
          }

          if (billingEmail) {
            const mailInfo = await sendPaymentInvoiceEmail({
              recipientEmail: billingEmail,
              recipientName: typeof name === "string" ? name : undefined,
              gstNumber,
              plan: resolvedPlan,
              userId: resolvedUserId || 0,
              orderId: toBigintOrderId(razorpay_order_id),
              amount: Number(amount || 0),
              currency,
              paymentMethod: "razorpay",
              paymentProvider: "razorpay",
              providerTransactionId: razorpay_payment_id,
              paidAt: new Date(),
            });

            await savedPayment.update({
              billing_email: billingEmail,
              invoice_email_sent: true,
              invoice_email_error: null,
              invoice_sent_at: new Date(),
              failure_reason:
                mailInfo?.messageId && !savedPayment.get("failure_reason")
                  ? `mail_message_id:${mailInfo.messageId}`
                  : savedPayment.get("failure_reason"),
            });
          }
        } catch (mailErr: any) {
          console.error("Invoice email send failed:", mailErr?.message || mailErr);
          await savedPayment.update({
            invoice_email_sent: false,
            invoice_email_error: String(mailErr?.message || mailErr || "invoice_email_failed"),
          });
        }
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
    await ensurePaymentMetadataColumns();

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
        const normalizedOrderId = toBigintOrderId(orderId);
        const notesUserId = Number(entity?.notes?.user_id || entity?.notes?.login_id || 0);
        const resolvedPlan =
          typeof entity?.notes?.plan === "string" && entity.notes.plan.trim()
            ? entity.notes.plan.trim()
            : null;
        const existing = await Payment.findOne({
          where: {
            [Op.or]: [{ order_id: normalizedOrderId }, { provider_transaction_id: String(paymentId || "") }],
          },
          order: [["created_at", "DESC"]],
        });
        let savedPayment: any;
        if (existing) {
          await (existing as any).update({
            order_id: normalizedOrderId,
            payment_method: "razorpay",
            payment_provider: "razorpay",
            provider_transaction_id: paymentId,
            amount: typeof amount === "number" ? amount : existing.get("amount"),
            status: "success",
            failure_reason: null,
            paid_at: new Date(),
            plan: resolvedPlan,
            gateway_order_id: String(orderId || ""),
            gateway_payment_id: String(paymentId || ""),
            callback_payload: req.body || null,
            invoice_email_sent: false,
            invoice_email_error: null,
            invoice_sent_at: null,
          });
          savedPayment = existing;
        } else {
          savedPayment = await Payment.create({
            user_id: notesUserId,
            order_id: normalizedOrderId,
            amount: typeof amount === "number" ? amount : 0,
            currency: String(entity?.currency || "INR"),
            payment_method: "razorpay",
            payment_provider: "razorpay",
            provider_transaction_id: paymentId || null,
            status: "success",
            failure_reason: null,
            paid_at: new Date(),
            plan: resolvedPlan,
            gateway_order_id: String(orderId || ""),
            gateway_payment_id: String(paymentId || ""),
            callback_payload: req.body || null,
            invoice_email_sent: false,
            invoice_email_error: null,
            invoice_sent_at: null,
          } as any);
        }

        // Send invoice from webhook path too; many clients rely only on webhook and skip /verify.
        let billingEmail =
          String(
            entity?.email ||
            entity?.notes?.email ||
            entity?.notes?.customer_email ||
            entity?.notes?.billing_email ||
            ""
          )
            .trim()
            .toLowerCase();

        let webhookGstNumber: string | null = null;
        if (notesUserId) {
          const user = await User.findByPk(notesUserId);
          if (!billingEmail) {
            const userEmail = (user as any)?.email;
            billingEmail = typeof userEmail === "string" ? userEmail.trim().toLowerCase() : "";
          }
          const companyInfo: any = (user as any)?.company_info || {};
          webhookGstNumber = companyInfo?.gst_number || companyInfo?.gstin || companyInfo?.gst || null;
        }

        if (billingEmail) {
          const webhookPlan = String(entity?.notes?.plan || (existing as any)?.get?.("plan") || "") || null;
          const mailInfo = await sendPaymentInvoiceEmail({
            recipientEmail: billingEmail,
            recipientName: String(entity?.notes?.name || entity?.notes?.customer_name || "") || undefined,
            gstNumber: webhookGstNumber,
            plan: webhookPlan,
            userId: notesUserId || Number((existing as any)?.get?.("user_id") || 0),
            orderId: normalizedOrderId,
            amount: typeof amount === "number" ? amount : Number((existing as any)?.get?.("amount") || 0),
            currency: String(entity?.currency || "INR"),
            paymentMethod: "razorpay",
            paymentProvider: "razorpay",
            providerTransactionId: paymentId || null,
            paidAt: new Date(),
          });

          await savedPayment.update({
            billing_email: billingEmail,
            invoice_email_sent: true,
            invoice_email_error: null,
            invoice_sent_at: new Date(),
            failure_reason:
              mailInfo?.messageId && !savedPayment.get("failure_reason")
                ? `mail_message_id:${mailInfo.messageId}`
                : savedPayment.get("failure_reason"),
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
