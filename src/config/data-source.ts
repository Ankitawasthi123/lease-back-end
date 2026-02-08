import { Sequelize } from "sequelize";
import config from "./env";

// Create Sequelize instance to connect to PostgreSQL
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: config.DB_HOST,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  port: config.DB_PORT,
  logging: false,  // Optional, to disable logging SQL queries
});

export default sequelize;