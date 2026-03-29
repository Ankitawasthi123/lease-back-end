import { Request, Response } from "express";
import { Payment, User } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";
import { sendPaymentInvoiceEmail } from "../utils/invoiceMailer";
import { ensurePaymentMetadataColumns } from "../utils/paymentSchema";

interface UserInvoiceData {
	email: string | null;
	recipientName: string | null;
	recipientPhone: string | null;
	gstNumber: string | null;
}

const pickNonEmptyString = (...values: unknown[]): string | null => {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return null;
};

const resolveUserInvoiceData = async (candidateEmail: unknown, userId: number): Promise<UserInvoiceData> => {
	const user = await User.findByPk(userId);
	if (!user) return { email: null, recipientName: null, recipientPhone: null, gstNumber: null };

	// Use dataValues for reliable raw field access
	const dv: any = (user as any).dataValues || user;

	const firstName   = String(dv.first_name   || "").trim();
	const middleName  = String(dv.middle_name  || "").trim();
	const lastName    = String(dv.last_name    || "").trim();
	const companyName = String(dv.company_name || "").trim();

	// Prefer personal name; fall back to company_name
	const personalName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
	const resolvedName = personalName || companyName || null;

	// Safely parse company_info whether it arrives as object or JSON string
	let companyInfo: any = dv.company_info || {};
	if (typeof companyInfo === "string") {
		try { companyInfo = JSON.parse(companyInfo); } catch { companyInfo = {}; }
	}

	// Try every common GST key name the frontend might use
	const gstNumber =
		companyInfo?.gst_number ||
		companyInfo?.gstin      ||
		companyInfo?.gst        ||
		companyInfo?.gstNumber  ||
		companyInfo?.gst_no     ||
		companyInfo?.GST        ||
		companyInfo?.GSTIN      ||
		companyInfo?.tax_number ||
		companyInfo?.taxId      ||
		null;

	const recipientPhone = String(dv.contact_number || "").trim() || null;

	const resolvedEmail =
		typeof candidateEmail === "string" && candidateEmail.trim()
			? candidateEmail.trim().toLowerCase()
			: typeof dv.email === "string" && dv.email.trim()
				? dv.email.trim().toLowerCase()
				: null;

	return { email: resolvedEmail, recipientName: resolvedName, recipientPhone, gstNumber };
};

export const createPayment = async (req: Request, res: Response) => {
	const {
		user_id,
		login_id,
		order_id,
		plan,
		amount,
		currency,
		payment_method,
		payment_provider,
		provider_transaction_id,
		txnid,
		mihpayid,
		error,
		error_Message,
		callback_payload,
		status,
		failure_reason,
		paid_at,
	} = req.body;

	const tokenUserId = req.user?.id ?? req.user?.login_id ?? req.user?.userId;
	const resolvedUserId = user_id ?? login_id ?? tokenUserId;

	if (!resolvedUserId || isNaN(Number(resolvedUserId))) {
		return sendErrorResponse(res, 400, "user_id is required and must be a valid number");
	}

	if (order_id === undefined || order_id === null) {
		return sendErrorResponse(res, 400, "order_id is required");
	}

	const rawOrderId = String(order_id).trim();
	if (!rawOrderId) {
		return sendErrorResponse(res, 400, "order_id is required");
	}

	const numericOrderId = /^\d+$/.test(rawOrderId)
		? rawOrderId
		: (rawOrderId.match(/\d+/g)?.join("") || "");

	if (!numericOrderId) {
		return sendErrorResponse(
			res,
			400,
			"order_id must contain numeric digits for bigint storage"
		);
	}

	if (amount === undefined || amount === null || isNaN(Number(amount))) {
		return sendErrorResponse(res, 400, "amount is required and must be a valid number");
	}

	if (!payment_method || typeof payment_method !== "string") {
		return sendErrorResponse(res, 400, "payment_method is required");
	}

	if (!payment_provider || typeof payment_provider !== "string") {
		return sendErrorResponse(res, 400, "payment_provider is required");
	}

	try {
		await ensurePaymentMetadataColumns();

		const normalizedStatus = String(status || callback_payload?.status || "pending")
			.trim()
			.toLowerCase()
			.replace(/[\s_-]+/g, "");
		const isPaymentFailed = /(fail|error|cancel|declin|denied|reject|void|timeout|expire)/.test(
			normalizedStatus
		);
		const isPaymentSuccessful =
			!isPaymentFailed && /(success|successful|paid|captur|complete|succeed)/.test(normalizedStatus);
		const resolvedProviderTransactionId =
			provider_transaction_id ||
			mihpayid ||
			txnid ||
			callback_payload?.mihpayid ||
			callback_payload?.txnid ||
			null;
		const resolvedFailureReason =
			failure_reason ||
			error_Message ||
			callback_payload?.error_Message ||
			error ||
			null;
		const payerDetails = callback_payload?.payer_details || {};
		const billingDetails = callback_payload?.billing_details || {};
		const requestRecipientName = pickNonEmptyString(
			billingDetails?.name,
			payerDetails?.fullName,
			payerDetails?.name,
			req.body?.name
		);
		const requestRecipientPhone = pickNonEmptyString(
			billingDetails?.phone,
			payerDetails?.phone,
			req.body?.phone,
			req.body?.contact_number
		);
		const requestRecipientEmail = pickNonEmptyString(
			billingDetails?.email,
			payerDetails?.email,
			req.body?.email
		)?.toLowerCase() || null;
		const resolvedPlan =
			typeof plan === "string" && plan.trim()
				? plan.trim()
				: typeof callback_payload?.plan === "string" && callback_payload.plan.trim()
					? callback_payload.plan.trim()
					: typeof callback_payload?.selected_plan === "string" && callback_payload.selected_plan.trim()
						? callback_payload.selected_plan.trim()
						: typeof callback_payload?.service_for === "string" && callback_payload.service_for.trim()
							? callback_payload.service_for.trim()
					: null;
		const paidAtValue = paid_at ? new Date(paid_at) : isPaymentSuccessful ? new Date() : null;

		const existingPayment = await Payment.findOne({
			where: {
				user_id: Number(resolvedUserId),
			},
			order: [["created_at", "DESC"]],
		});

		if (existingPayment) {
			await existingPayment.update({
				order_id: numericOrderId,
				amount: Number(amount),
				currency: currency || "INR",
				payment_method: payment_method.trim(),
				payment_provider: payment_provider.trim(),
				provider_transaction_id: resolvedProviderTransactionId,
				status: normalizedStatus,
				failure_reason: resolvedFailureReason,
				paid_at: paidAtValue,
				plan: resolvedPlan,
				billing_email: requestRecipientEmail,
				gateway_order_id: String(req.body?.gateway_order_id || order_id || "") || null,
				gateway_payment_id:
					String(req.body?.gateway_payment_id || resolvedProviderTransactionId || "") || null,
				gateway_signature: String(req.body?.gateway_signature || req.body?.signature || "") || null,
				callback_payload: callback_payload || req.body || null,
				invoice_email_sent: false,
				invoice_email_error: null,
				invoice_sent_at: null,
			});

			if (!isPaymentSuccessful) {
				return res.status(200).json({
					success: false,
					message: "Payment not done",
				});
			}

				try {
					const userInvoiceData = await resolveUserInvoiceData(requestRecipientEmail, Number(resolvedUserId));
					if (userInvoiceData.email) {
						const mailInfo = await sendPaymentInvoiceEmail({
							recipientEmail: userInvoiceData.email,
							recipientName: requestRecipientName || userInvoiceData.recipientName || undefined,
							recipientPhone: requestRecipientPhone || userInvoiceData.recipientPhone || undefined,
							gstNumber: userInvoiceData.gstNumber,
							plan: resolvedPlan,
							userId: Number(resolvedUserId),
							orderId: numericOrderId,
							amount: Number(amount),
							currency: currency || "INR",
							paymentMethod: payment_method.trim(),
							paymentProvider: payment_provider.trim(),
							providerTransactionId: resolvedProviderTransactionId,
							paidAt: paidAtValue,
						});

						await existingPayment.update({
							billing_email: userInvoiceData.email,
						invoice_email_sent: true,
						invoice_email_error: null,
						invoice_sent_at: new Date(),
						failure_reason:
							mailInfo?.messageId && !resolvedFailureReason
								? `mail_message_id:${mailInfo.messageId}`
								: resolvedFailureReason,
					});
				}
			} catch (mailErr: any) {
				console.error("Invoice email send failed:", mailErr?.message || mailErr);
				await existingPayment.update({
					invoice_email_sent: false,
					invoice_email_error: String(mailErr?.message || mailErr || "invoice_email_failed"),
				});
			}

			return res.status(200).json({
				success: true,
				message: "Payment updated successfully",
				data: existingPayment.toJSON(),
			});
		}

		const maxExistingId = await Payment.max("id");
		const nextPaymentId = Number(maxExistingId || 0) + 1;

		const payment = await Payment.create({
			id: nextPaymentId,
			user_id: Number(resolvedUserId),
			order_id: numericOrderId,
			amount: Number(amount),
			currency: currency || "INR",
			payment_method: payment_method.trim(),
			payment_provider: payment_provider.trim(),
			provider_transaction_id: resolvedProviderTransactionId,
			status: normalizedStatus,
			failure_reason: resolvedFailureReason,
			paid_at: paidAtValue,
			plan: resolvedPlan,
			billing_email: requestRecipientEmail,
			gateway_order_id: String(req.body?.gateway_order_id || order_id || "") || null,
			gateway_payment_id:
				String(req.body?.gateway_payment_id || resolvedProviderTransactionId || "") || null,
			gateway_signature: String(req.body?.gateway_signature || req.body?.signature || "") || null,
			callback_payload: callback_payload || req.body || null,
			invoice_email_sent: false,
			invoice_email_error: null,
			invoice_sent_at: null,
		});

		if (!isPaymentSuccessful) {
			return res.status(200).json({
				success: false,
				message: "Payment not done",
			});
		}

		try {
			const userInvoiceData = await resolveUserInvoiceData(requestRecipientEmail, Number(resolvedUserId));
			if (userInvoiceData.email) {
				const mailInfo = await sendPaymentInvoiceEmail({
					recipientEmail: userInvoiceData.email,
					recipientName: requestRecipientName || userInvoiceData.recipientName || undefined,
					recipientPhone: requestRecipientPhone || userInvoiceData.recipientPhone || undefined,
					gstNumber: userInvoiceData.gstNumber,
					plan: resolvedPlan,
					userId: Number(resolvedUserId),
					orderId: numericOrderId,
					amount: Number(amount),
					currency: currency || "INR",
					paymentMethod: payment_method.trim(),
					paymentProvider: payment_provider.trim(),
					providerTransactionId: resolvedProviderTransactionId,
					paidAt: paidAtValue,
				});

				await payment.update({
					billing_email: userInvoiceData.email,
					invoice_email_sent: true,
					invoice_email_error: null,
					invoice_sent_at: new Date(),
					failure_reason:
						mailInfo?.messageId && !resolvedFailureReason
							? `mail_message_id:${mailInfo.messageId}`
							: resolvedFailureReason,
				});
			}
		} catch (mailErr: any) {
			console.error("Invoice email send failed:", mailErr?.message || mailErr);
			await payment.update({
				invoice_email_sent: false,
				invoice_email_error: String(mailErr?.message || mailErr || "invoice_email_failed"),
			});
		}

		return res.status(201).json({
			success: true,
			message: "Payment created successfully",
			data: payment.toJSON(),
		});
	} catch (err: any) {
		console.error("Create Payment Error:", err.message || err);
		return sendErrorResponse(res, 500, "Failed to create payment", err);
	}
};

// GET /payment/user/:user_id - retrieve all payments for a specific user
export const getPaymentsByUser = async (req: Request, res: Response) => {
	const userIdParam = req.params.user_id || req.query.user_id;
	if (!userIdParam || isNaN(Number(userIdParam))) {
		return sendErrorResponse(res, 400, "user_id parameter is required and must be a number");
	}
	const userId = Number(userIdParam);
	try {
		const payments = await Payment.findAll({ where: { user_id: userId } });
		return res.status(200).json({ success: true, data: payments });
	} catch (err: any) {
		console.error("Error fetching payments for user", userId, err.message || err);
		return sendErrorResponse(res, 500, "Failed to retrieve payments", err);
	}
};

