import { z } from "zod";

export const sendBroadcastNotificationSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "title is required")
      .max(100, "title must be 100 chars or less"),
    message: z
      .string()
      .trim()
      .min(1, "message is required")
      .max(2000, "message must be 2000 chars or less"),
    url: z.string().trim().url("url must be a valid URL").optional(),
    data: z.record(z.string(), z.any()).optional(),
    playerIds: z
      .array(
        z
          .string()
          .trim()
          .min(1, "playerId cannot be empty")
      )
      .max(2000, "playerIds max limit is 2000")
      .optional(),
    contactNumbers: z
      .array(
        z
          .string()
          .trim()
          .min(1, "contact number cannot be empty")
      )
      .max(2000, "contactNumbers max limit is 2000")
      .optional(),
    useDatabaseContacts: z.boolean().optional(),
  }),
});
