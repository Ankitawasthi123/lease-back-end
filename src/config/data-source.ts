import { Sequelize } from "sequelize";

// Create Sequelize instance to connect to PostgreSQL
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost', 
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Ankit@123',
  database: process.env.DB_NAME || 'demodb',
  logging: false,  // Optional, to disable logging SQL queries
});

export default sequelize;