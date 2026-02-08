import { Response } from "express";

/**
 * Production-level error response utility
 * Ensures consistent error formatting across all controllers
 * 
 * In production: No internal error details exposed
 * In development: Full error details included for debugging
 */
export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  error?: any
): Response => {
  const isDev = process.env.NODE_ENV === "development";
  
  const response: any = {
    success: false,
    status: statusCode,
    message,
  };

  // Only include error details in development mode
  if (isDev && error) {
    response.details = error.message || String(error);
    if (error.name) response.errorType = error.name;
  }

  return res.status(statusCode).json(response);
};

/**
 * Common error messages for production
 */
export const ErrorMessages = {
  INVALID_INPUT: "Invalid input provided",
  NOT_FOUND: "Resource not found",
  UNAUTHORIZED: "You do not have permission to perform this action",
  CONFLICT: "Resource already exists",
  VALIDATION_ERROR: "Validation failed",
  DATABASE_ERROR: "Database operation failed",
  INTERNAL_ERROR: "An internal error occurred",
  NOT_AUTHENTICATED: "User is not authenticated",
  DUPLICATE_RESOURCE: "This resource already exists",
};

/**
 * Helper to determine appropriate status code for errors
 */
export const getStatusCode = (error: any): number => {
  if (error.statusCode) return error.statusCode;
  if (error.name === "ValidationError") return 400;
  if (error.name === "UnauthorizedError") return 401;
  if (error.name === "ForbiddenError") return 403;
  if (error.name === "NotFoundError") return 404;
  if (error.name === "ConflictError") return 409;
  if (error.name?.includes("Sequelize")) {
    if (error.name === "SequelizeValidationError") return 400;
    if (error.name === "SequelizeUniqueConstraintError") return 409;
    if (error.name === "SequelizeConnectionError") return 503;
    return 500;
  }
  return 500;
};

/**
 * Safe error message for production
 * Returns generic message for 5xx errors, specific for 4xx
 */
export const getSafeErrorMessage = (statusCode: number, customMessage?: string): string => {
  if (statusCode >= 500) {
    return customMessage || ErrorMessages.INTERNAL_ERROR;
  }
  return customMessage || ErrorMessages.INVALID_INPUT;
};
