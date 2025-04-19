declare namespace Express {
    export interface Request {
      user?: { // Define the shape of the user object here
        userId: string;
        role: string;
      };
    }
  }