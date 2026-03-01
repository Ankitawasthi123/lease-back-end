import { Request, Response } from "express";
import { Payment } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";

export const createPayment = async (req: Request, res: Response) => {
	const {
		user_id,
		login_id,
		order_id,
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
			});

			if (!isPaymentSuccessful) {
				return res.status(200).json({
					success: false,
					message: "Payment not done",
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
		});

		if (!isPaymentSuccessful) {
			return res.status(200).json({
				success: false,
				message: "Payment not done",
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

