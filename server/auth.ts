import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, seedSampleProjectsForUser } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export interface AuthTokenPayload {
  userId: number;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = header.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    const userRow = db
      .prepare('SELECT id, name, email FROM users WHERE id = ?')
      .get(decoded.userId) as { id: number; name: string; email: string } | undefined;
    if (!userRow) {
      res.status(401).json({ error: 'User session is no longer valid.' });
      return;
    }
    req.user = { userId: userRow.id, email: userRow.email, name: userRow.name };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function registerUser(name: string, email: string, password: string) {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2) {
    return { ok: false as const, status: 400, error: 'Full name must be at least 2 characters.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false as const, status: 400, error: 'Please enter a valid email address.' };
  }
  if (password.length < 8) {
    return { ok: false as const, status: 400, error: 'Password must be at least 8 characters.' };
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return { ok: false as const, status: 409, error: 'An account with this email already exists.' };
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(cleanName, cleanEmail, passwordHash, 'developer');

  const userId = Number(result.lastInsertRowid);
  seedSampleProjectsForUser(userId, cleanEmail);

  const user = db
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(userId) as { id: number; name: string; email: string; role: string; created_at: string };

  const token = signAuthToken({ userId: user.id, email: user.email, name: user.name });
  return { ok: true as const, user, token };
}

export function loginUser(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { ok: false as const, status: 400, error: 'Email and password are required.' };
  }

  const userRow = db
    .prepare('SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ?')
    .get(cleanEmail) as
    | {
        id: number;
        name: string;
        email: string;
        password_hash: string;
        role: string;
        created_at: string;
      }
    | undefined;

  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    return { ok: false as const, status: 401, error: 'Invalid email or password.' };
  }

  const user = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    role: userRow.role,
    created_at: userRow.created_at,
  };
  const token = signAuthToken({ userId: user.id, email: user.email, name: user.name });
  return { ok: true as const, user, token };
}
