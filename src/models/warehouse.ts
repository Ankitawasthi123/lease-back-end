import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class Warehouse extends Model {
  public id!: number;
  public login_id!: number;
  public warehouse_location!: object;
  public warehouse_size!: object;
  public warehouse_compliance!: object;
  public material_details!: object;
  public description!: string;
  public requirement_type!: string;
  public pdf_file!: object | null;
  public status!: string;
  public company_details!: object;
  public created_date!: Date;
}

Warehouse.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    login_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    warehouse_location: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    warehouse_size: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    warehouse_compliance: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    material_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requirement_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pdf_file: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "submitted",
    },
    company_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    created_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "warehouse",
    modelName: "Warehouse",
    timestamps: false,
  }
);

export default Warehouse;

// Type interfaces for request/response (legacy support)
export interface CreateWarehouseRequest {
  warehouse_location: object;
  warehouse_size: string;
  warehouse_compliance: object;
  material_details: object;
  description?: string;
  requirement_type?: string;
  pdf_file?: object | null;
  login_id: string;
  status?: string;
  company_details?: object;
}

export interface UpdateWarehouseRequest {
  login_id: string;
  id: string;
  warehouse_location: object;
  warehouse_size: string;
  warehouse_compliance: object;
  material_details: object;
  description?: string;
  requirement_type?: string;
  pdf_file?: object | null;
}

export interface DeleteWarehouseRequest {
  login_id: string;
  id: string;
}

export interface WarehouseResponse {
  id: string;
  warehouse_location: object;
  warehouse_size: string;
  warehouse_compliance: object;
  material_details: object;
  description?: string;
  requirement_type?: string;
  pdf_file?: object | null;
  login_id: string;
  status?: string;
  company_details?: object;
  success?: boolean;
  message?: string;
  data?: any;
}
