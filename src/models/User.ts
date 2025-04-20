import { Model, DataTypes } from "sequelize";
import sequelize  from "../config/data-source";

class User extends Model {
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public role!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user",
    }
  },
  {
    sequelize, // Connection instance
    tableName: "users", // Table name
    modelName: "User", // Model name
    timestamps: false, // Adds `createdAt` and `updatedAt` columns
  }
);

export default User;
