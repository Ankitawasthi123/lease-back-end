import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  CLIENT_URL: string;
  DB_HOST: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_PORT: number;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  TWILIO_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_VERIFY_SID: string;
  UPLOAD_DIR: string;
  MAX_FILE_SIZE: number;
}

const getEnvVariable = (key: keyof EnvConfig, defaultValue?: string | number): string | number => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
};

const config: EnvConfig = {
  PORT: Number(getEnvVariable('PORT', 5000)),
  NODE_ENV: String(getEnvVariable('NODE_ENV', 'development')),
  CLIENT_URL: String(getEnvVariable('CLIENT_URL', 'http://localhost:3000')),
  DB_HOST: String(getEnvVariable('DB_HOST', 'localhost')),
  DB_USER: String(getEnvVariable('DB_USER', 'postgres')),
  DB_PASSWORD: String(getEnvVariable('DB_PASSWORD')),
  DB_NAME: String(getEnvVariable('DB_NAME', 'demodb')),
  DB_PORT: Number(getEnvVariable('DB_PORT', 5432)),
  JWT_SECRET: String(getEnvVariable('JWT_SECRET')),
  JWT_REFRESH_SECRET: String(getEnvVariable('JWT_REFRESH_SECRET')),
  SMTP_HOST: String(getEnvVariable('SMTP_HOST')),
  SMTP_PORT: Number(getEnvVariable('SMTP_PORT', 587)),
  SMTP_USER: String(getEnvVariable('SMTP_USER')),
  SMTP_PASS: String(getEnvVariable('SMTP_PASS')),
  SMTP_FROM: String(getEnvVariable('SMTP_FROM')),
  TWILIO_SID: String(getEnvVariable('TWILIO_SID')),
  TWILIO_AUTH_TOKEN: String(getEnvVariable('TWILIO_AUTH_TOKEN')),
  TWILIO_VERIFY_SID: String(getEnvVariable('TWILIO_VERIFY_SID')),
  UPLOAD_DIR: String(getEnvVariable('UPLOAD_DIR', 'uploads/')),
  MAX_FILE_SIZE: Number(getEnvVariable('MAX_FILE_SIZE', 5242880)),
};

export default config;
