import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class Transport extends Model {
  public id!: number;
  public company_details!: object;
  public transport_mode!: object;
  public service_type!: object;
  public rate_type!: object;
  public minimum_freight_type_basewise!: object;
  public charges!: object;
  public demurrage_information!: object;
  public freight_related_services!: object;
  public matrices!: object;
  public pickup_delivery!: object;
  public volumetric!: object;
  public risk_information!: object;
  public owner_risk_slab!: any[];
  public created_at!: string;
  public updated_at!: string;
  public status!: string;
}

Transport.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    company_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    transport_mode: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    service_type: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    rate_type: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    minimum_freight_type_basewise: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    charges: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    demurrage_information: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    freight_related_services: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    matrices: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    pickup_delivery: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    volumetric: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    risk_information: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    owner_risk_slab: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    updated_at: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "submitted",
    },
  },
  {
    sequelize,
    tableName: "transport",
    modelName: "Transport",
    timestamps: false,
  }
);

export default Transport;
