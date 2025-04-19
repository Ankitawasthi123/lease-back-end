import { Sequelize } from "sequelize";

// Create Sequelize instance to connect to PostgreSQL
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost', 
  username: process.env.DB_USER || 'your_username',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_NAME || 'your_database',
  logging: false,  // Optional, to disable logging SQL queries
});

export default sequelize;