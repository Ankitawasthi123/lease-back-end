declare namespace Express {
    export interface Request {
      user?: { // Define the shape of the user object here
        // token payload fields (string IDs) and optional numeric IDs used across controllers
        userId?: string;
        id?: number | string;
        login_id?: number | string;
        role?: string;
        [key: string]: any;
      };
    }
  }