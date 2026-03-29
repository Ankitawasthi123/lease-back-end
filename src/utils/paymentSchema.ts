import sequelize from "../config/data-source";

let ensureColumnsPromise: Promise<void> | null = null;

export const ensurePaymentMetadataColumns = async (): Promise<void> => {
  if (ensureColumnsPromise) {
    return ensureColumnsPromise;
  }

  ensureColumnsPromise = (async () => {
    await sequelize.query(`
      ALTER TABLE payment
      ADD COLUMN IF NOT EXISTS plan TEXT,
      ADD COLUMN IF NOT EXISTS billing_email VARCHAR(320),
      ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS gateway_signature TEXT,
      ADD COLUMN IF NOT EXISTS callback_payload JSONB,
      ADD COLUMN IF NOT EXISTS invoice_email_sent BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS invoice_email_error TEXT,
      ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMP NULL
    `);
  })().catch((error) => {
    ensureColumnsPromise = null;
    throw error;
  });

  return ensureColumnsPromise;
};
