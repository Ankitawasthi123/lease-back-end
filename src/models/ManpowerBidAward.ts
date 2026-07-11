import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class ManpowerBidAward extends Model {
  public id!: string;
  public manpower_requirement_id!: string;
  public manpower_bid_id!: string;
  public contractor_id!: string;
  public awarded_by!: string;
  public status!: string;
  public readonly awarded_at!: Date;
}

ManpowerBidAward.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    manpower_requirement_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "manpower_requirements",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    manpower_bid_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "manpower_bids",
        key: "bid_id",
      },
      onDelete: "CASCADE",
    },
    contractor_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    awarded_by: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "awarded",
    },
    awarded_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "manpower_bid_awards",
    modelName: "ManpowerBidAward",
    timestamps: false,
  },
);

export default ManpowerBidAward;
