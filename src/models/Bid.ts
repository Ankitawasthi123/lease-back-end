import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class Bid extends Model {
  public id!: number;
  public requirement_id!: number;
  public pl_details!: object;
  public bid_type!: string;
  public bid_details!: object;
  public status!: string;
  public created_date!: Date;
}

Bid.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    requirement_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pl_details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    bid_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    bid_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "PENDING",
    },
    created_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "bids",
    modelName: "Bid",
    timestamps: false,
  }
);

export default Bid;
