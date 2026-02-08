import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class Retail extends Model {
  public id!: number;
  public login_id!: number;
  public retail_details!: string;
  public retail_type!: any[];
  public retail_compliance!: object;
  public status!: string;
  public company_details!: object;
  public created_date!: Date;
  public updated_at!: Date;
}

Retail.init(
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
    retail_details: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    retail_type: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    retail_compliance: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
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
    tableName: "retail",
    modelName: "Retail",
    timestamps: false,
  }
);

export default Retail;
