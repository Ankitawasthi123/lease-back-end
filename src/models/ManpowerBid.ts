import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class ManpowerBid extends Model {
  public bid_id!: string;
  public manpower_requirement_id!: string;
  public contractor_id!: string;
  public status!: string;
  public commercial_quotation!: any[];
  public margin_charges!: any;
  public commercial_summary!: any;
  public contractor_capability!: any;
  public documents!: any;
  public declaration!: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ManpowerBid.init(
  {
    bid_id: {
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
    contractor_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "submitted",
    },
    commercial_quotation: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    margin_charges: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    commercial_summary: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    contractor_capability: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    documents: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    declaration: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    tableName: "manpower_bids",
    modelName: "ManpowerBid",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default ManpowerBid;
