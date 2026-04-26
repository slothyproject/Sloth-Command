/**
 * Authentication Middleware
 * JWT token verification for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId?: string;
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
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: string; userId?: string; iat: number; exp: number };
    const id = decoded.id || decoded.userId;
    if (!id) {
      return res.status(403).json({
        success: false,
        error: 'Invalid authentication token',
      });
    }
    req.user = { ...decoded, id, userId: decoded.userId || id };
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
      const decoded = jwt.verify(token, JWT_SECRET) as { id?: string; userId?: string; iat: number; exp: number };
      const id = decoded.id || decoded.userId;
      if (id) {
        req.user = { ...decoded, id, userId: decoded.userId || id };
      }
    } catch (error) {
      // Silently ignore invalid tokens for optional auth
    }
  }

  next();
}
