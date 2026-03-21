import { Request, Response } from "express";
import axios from "axios";
import pool from "../../config/db";
import config from "../../config/env";

export const sendBroadcastNotification = async (req: Request, res: Response) => {
  try {
    const actorId = Number(req.user?.id ?? req.user?.login_id);
    if (!Number.isInteger(actorId) || actorId <= 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const actorResult = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [actorId]
    );

    if (!actorResult.rowCount) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    if (actorResult.rows[0].role !== "admin") {
      return res.status(403).json({ message: "Only admins can send notifications" });
    }

    if (!config.ONESIGNAL_REST_API_KEY) {
      return res.status(500).json({
        message: "OneSignal API key is not configured",
        expectedEnv: ["ONESIGNAL_REST_API_KEY", "ONESIGNAL_API_KEY"],
      });
    }

    const {
      title,
      message,
      url,
      data,
      playerIds,
      contactNumbers,
      useDatabaseContacts,
    } = req.body;

    const validPlayerIds = Array.isArray(playerIds)
      ? playerIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];

    const providedContactNumbers = Array.isArray(contactNumbers)
      ? contactNumbers
          .map((value: unknown) => String(value).trim())
          .filter((value: string) => value.length > 0)
      : [];

    let dbContactNumbers: string[] = [];
    if (useDatabaseContacts === true) {
      const contactsResult = await pool.query(
        `
          SELECT DISTINCT contact_number
          FROM users
          WHERE contact_number IS NOT NULL
            AND TRIM(contact_number) <> ''
        `
      );

      dbContactNumbers = contactsResult.rows
        .map((row: { contact_number: string }) => String(row.contact_number).trim())
        .filter((value: string) => value.length > 0);
    }

    const validContactNumbers = [...providedContactNumbers, ...dbContactNumbers].slice(0, 2000);

    const payload: Record<string, unknown> = {
      app_id: config.ONESIGNAL_APP_ID,
      target_channel: "push",
      headings: { en: title },
      contents: { en: message },
    };

    if (validPlayerIds.length > 0) {
      payload.include_player_ids = validPlayerIds;
    } else if (validContactNumbers.length > 0) {
      payload.include_aliases = { external_id: validContactNumbers };
    } else {
      payload.included_segments = ["Subscribed Users"];
    }

    if (url) {
      payload.url = url;
    }

    if (data && typeof data === "object") {
      payload.data = data;
    }

    const response = await axios.post(
      "https://api.onesignal.com/notifications?c=push",
      payload,
      {
        headers: {
          Authorization: `Key ${config.ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const hasErrors = Array.isArray(response.data?.errors) && response.data.errors.length > 0;
    const hasNotificationId = Boolean(response.data?.id);

    if (hasErrors || !hasNotificationId) {
      return res.status(200).json({
        delivered: false,
        message: "Notification was accepted but not delivered",
        reason:
          validPlayerIds.length > 0
            ? "Provided playerIds are invalid/unsubscribed or do not belong to this OneSignal app"
            : validContactNumbers.length > 0
              ? "Provided contact numbers are not mapped in OneSignal as external_id"
            : "No subscribed users/devices matched the target segment",
        targets: {
          playerIdsCount: validPlayerIds.length,
          contactNumbersCount: validContactNumbers.length,
          usedDatabaseContacts: useDatabaseContacts === true,
        },
        onesignal_response: response.data,
      });
    }

    return res.status(200).json({
      delivered: true,
      message:
        validPlayerIds.length > 0
          ? "Notification sent to selected devices"
          : validContactNumbers.length > 0
            ? "Notification sent using contact_number aliases"
          : "Notification sent to all subscribed users",
      notification_id: response.data?.id,
      recipients: response.data?.recipients,
      targets: {
        playerIdsCount: validPlayerIds.length,
        contactNumbersCount: validContactNumbers.length,
        usedDatabaseContacts: useDatabaseContacts === true,
      },
      onesignal_response: response.data,
    });
  } catch (error: any) {
    const statusCode = error?.response?.status || 500;
    const details = error?.response?.data || error?.message || "Unknown error";

    return res.status(statusCode).json({
      message: "Failed to send OneSignal notification",
      details,
    });
  }
};
