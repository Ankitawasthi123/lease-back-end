import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class User extends Model {
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public role!: string;

  public company_info!: object;
  public registered_address!: object;
  public director_info!: object;
  public filler_info!: object;

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
    },

    // 👇 Add these new fields
    company_info: {
      type: DataTypes.JSONB, // PostgreSQL JSONB type
      allowNull: true,
    },
    registered_address: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    director_info: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    filler_info: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "users",
    modelName: "User",
    timestamps: false,
  }
);

export default User;
