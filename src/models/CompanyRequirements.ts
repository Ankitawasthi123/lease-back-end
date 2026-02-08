import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class CompanyRequirements extends Model {
  public id!: number;
  public company_id!: number;
  public warehouse_location!: object;
  public warehouse_size!: object;
  public warehouse_compliance!: object;
  public material_details!: object;
  public labour_details!: object;
  public office_expenses!: object;
  public transport!: any[];
  public requirement_type!: string;
  public bid_details!: object;
  public distance!: any[];
  public status!: string;
  public created_date!: Date;
}

CompanyRequirements.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
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
    labour_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    office_expenses: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    transport: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    requirement_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    bid_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    distance: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "submitted",
    },
    created_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "company_requirements",
    modelName: "CompanyRequirements",
    timestamps: false,
  }
);

export default CompanyRequirements;
