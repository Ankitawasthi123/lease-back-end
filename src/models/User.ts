import { Model, DataTypes } from "sequelize";
import sequelize from "../config/data-source";

class User extends Model {
  public id!: number;
  public first_name!: string;
  public middle_name!: string;
  public last_name!: string;
  public email!: string;
  public contact_number!: string;
  public password!: string;
  public role!: string;
  public company_name!: string;
  public designation!: string;

  public company_info!: object | null;
  public registered_address!: object | null;
  public communication_address!: object | null;
  public director_info!: object | null;
  public filler_info!: object | null;

  // ✅ OTP fields
  public email_otp!: string | null;
  public mobile_otp!: string | null;
  public otp_expires_at!: Date| null;
  public mobile_verified!: boolean;
  public email_verified!: boolean;

  public profile_image!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    first_name: { type: DataTypes.STRING, allowNull: false },
    middle_name: { type: DataTypes.STRING, allowNull: false },
    last_name: { type: DataTypes.STRING, allowNull: false },
    contact_number: { type: DataTypes.STRING, allowNull: false },
    designation: { type: DataTypes.STRING, allowNull: false },
    company_name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: "user" },
    company_info: { type: DataTypes.JSONB, allowNull: true },
    registered_address: { type: DataTypes.JSONB, allowNull: true },
    communication_address: { type: DataTypes.JSONB, allowNull: true },
    director_info: { type: DataTypes.JSONB, allowNull: true },
    filler_info: { type: DataTypes.JSONB, allowNull: true },

    // ✅ Add these OTP fields
    email_otp: { type: DataTypes.STRING, allowNull: true },
    mobile_otp: { type: DataTypes.STRING, allowNull: true },
    otp_expires_at: { type: DataTypes.DATE, allowNull: true },
    mobile_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    email_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    profile_image: { type: DataTypes.STRING, allowNull: false },

    
  },
  {
    sequelize,
    tableName: "users",
    modelName: "User",
    timestamps: false,
  }
);


export default User;
