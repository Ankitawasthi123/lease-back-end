import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class Payment extends Model {
  public id!: number;
  public user_id!: number;
  public order_id!: string;
  public amount!: number;
  public currency!: string;
  public payment_method!: string;
  public payment_provider!: string;
  public provider_transaction_id!: string | null;
  public status!: string;
  public failure_reason!: string | null;
  public paid_at!: Date | null;
  public plan!: string | null;
  public billing_email!: string | null;
  public gateway_order_id!: string | null;
  public gateway_payment_id!: string | null;
  public gateway_signature!: string | null;
  public callback_payload!: object | null;
  public invoice_email_sent!: boolean;
  public invoice_email_error!: string | null;
  public invoice_sent_at!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Payment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "INR",
    },
    payment_method: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payment_provider: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    provider_transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    plan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    billing_email: {
      type: DataTypes.STRING(320),
      allowNull: true,
    },
    gateway_order_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gateway_payment_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gateway_signature: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    callback_payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    invoice_email_sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    invoice_email_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invoice_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "payment",
    modelName: "Payment",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Payment;
