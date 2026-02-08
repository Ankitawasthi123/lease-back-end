import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class Pitch extends Model {
  public id!: number;
  public warehouse_id!: number;
  public login_id!: number;
  public warehouse_location!: string | null;
  public warehouse_size!: object;
  public warehouse_compliance!: object;
  public material_details!: object;
  public justification!: string;
  public image_files!: any[];
  public pdf_files!: object | null;
  public rate_details!: object;
  public status!: string;
  public pitcher_details!: object;
  public created_date!: Date;
}

Pitch.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    login_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    warehouse_location: {
      type: DataTypes.STRING,
      allowNull: true,
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
    justification: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    rate_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    pitcher_details: {
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
    tableName: "pitches",
    modelName: "Pitch",
    timestamps: false,
  }
);

export default Pitch;
