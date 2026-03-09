import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class QueryMessage extends Model {
  public id!: number;
  public name!: string;
  public email!: string;
  public phone!: string;
  public service!: string;
  public query!: string;
  public created_at?: Date;
}

QueryMessage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    phone: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    service: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    query: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "queries",
    modelName: "QueryMessage",
    timestamps: false,
  }
);

export default QueryMessage;
