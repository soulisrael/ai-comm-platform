import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TeamMember, TeamRole } from '../../types/team';
import { AppError } from './error-handler';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface TeamTokenPayload {
  memberId: string;
  email: string;
  role: TeamRole;
}

declare global {
  namespace Express {
    interface Request {
      teamMember?: TeamTokenPayload;
    }
  }
}

/**
 * Generate a JWT token for a team member.
 */
export function generateTeamToken(member: TeamMember): string {
  const payload: TeamTokenPayload = {
    memberId: member.id,
    email: member.email,
    role: member.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verify JWT token from Authorization header.
 */
export function verifyTeamToken(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authorization token required', 401, 'AUTH_REQUIRED');
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TeamTokenPayload;
    req.teamMember = payload;
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401, 'AUTH_INVALID');
  }
}

/**
 * Require specific roles for access.
 */
export function requireRole(...roles: TeamRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.teamMember) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }
    if (!roles.includes(req.teamMember.role)) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }
    next();
  };
}

/**
 * Extract team member info without requiring auth (optional auth).
 */
export function extractTeamMember(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TeamTokenPayload;
      req.teamMember = payload;
    } catch {
      // Token invalid — continue without team member
    }
  }
  next();
}
