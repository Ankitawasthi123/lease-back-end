import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class ManpowerRequirement extends Model {
  public id!: string;
  public requirement_id!: string;
  public company_id!: string;
  public status!: string;
  public company_details!: any;
  public requirement_details!: any;
  public manpower_rows!: any[];
  public industry_categories!: any[];
  public preferred_industry_experience!: any[];
  public contractor_scope!: any[];
  public commercial_terms!: any;
  public supporting_pdf_path!: string | null;
  public additional_notes!: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ManpowerRequirement.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    requirement_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "submitted",
    },
    company_details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    requirement_details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    manpower_rows: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    industry_categories: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    preferred_industry_experience: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    contractor_scope: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    commercial_terms: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    supporting_pdf_path: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    additional_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "manpower_requirements",
    modelName: "ManpowerRequirement",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default ManpowerRequirement;
