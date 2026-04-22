/**
 * Authentication Middleware
 * JWT token verification for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        iat: number;
        exp: number;
      };
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authentication token',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; iat: number; exp: number };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication - continues even if token is invalid
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; iat: number; exp: number };
      req.user = decoded;
    } catch (error) {
      // Silently ignore invalid tokens for optional auth
    }
  }

  next();
}
