import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class RetailPitch extends Model {
  public id!: number;
  public retail_id!: number;
  public login_id!: number;
  public retail_details!: object;
  public retail_compliance!: object;
  public property_type!: string;
  public justification!: string;
  public company_details!: object;
  public image_files!: any[];
  public pdf_files!: object | null;
  public status!: string;
  public created_date!: Date;
}

RetailPitch.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    retail_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    login_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    retail_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    retail_compliance: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    property_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    justification: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    company_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    image_files: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    pdf_files: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    created_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "retail_pitches",
    modelName: "RetailPitch",
    timestamps: false,
  }
);

export default RetailPitch;
