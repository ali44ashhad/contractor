import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models/User';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { verifyToken, extractTokenFromCookie, extractTokenFromHeader } from '../utils/jwt';

/**
 * Extended Request interface to include user information
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

/**
 * JWT Authentication middleware
 * Extracts and verifies JWT token from cookies (preferred) or Authorization header (fallback)
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try to extract token from cookie first (preferred method)
    let token = extractTokenFromCookie(req.cookies?.token);
    
    // Fallback to Authorization header for backward compatibility
    if (!token) {
      const authHeader = req.headers.authorization;
      token = extractTokenFromHeader(authHeader);
    }

    if (!token) {
      throw new UnauthorizedError('No token provided. Please login to continue');
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error: any) {
      if (error.message === 'Token has expired') {
        throw new UnauthorizedError('Token has expired. Please login again');
      }
      if (error.message === 'Invalid token') {
        throw new UnauthorizedError('Invalid token. Please provide a valid authentication token');
      }
      throw new UnauthorizedError('Authentication failed');
    }

    // Verify user exists and is active
    const user = await User.findById(decoded.id).select('email role isActive');

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is inactive. Please contact administrator');
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};

/**
 * Combined authentication and authorization middleware
 */
export const requireAuth = (allowedRoles: UserRole[]) => {
  return [authenticate, authorize(...allowedRoles)];
};

