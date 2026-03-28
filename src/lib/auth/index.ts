import { db } from '@/lib/db';
import { User, UserStatus, UserRole } from '@prisma/client';
import {
  generateTokenPair,
  verifyToken,
  type JWTPayload,
} from './jwt';
import { hashPassword, verifyPassword, validatePassword } from './password';

export interface AuthResult {
  user: Omit<User, 'passwordHash'>;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
  orgSlug?: string;
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(
  credentials: LoginCredentials
): Promise<AuthResult | null> {
  const { email, password, orgSlug } = credentials;

  // Find user by email
  const user = await db.user.findFirst({
    where: { email: email.toLowerCase() },
    include: { org: true },
  });

  if (!user || !user.passwordHash) {
    return null;
  }

  // Check if user is active
  if (user.status !== UserStatus.ACTIVE) {
    return null;
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return null;
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    // Increment login attempts
    const attempts = user.loginAttempts + 1;
    const updateData: any = {
      loginAttempts: attempts,
    };

    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }

    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return null;
  }

  // Reset login attempts on successful login
  await db.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // Check organization slug if provided
  if (orgSlug && user.org.slug !== orgSlug) {
    return null;
  }

  // Generate tokens
  const tokens = await generateTokenPair({
    userId: user.id,
    orgId: user.orgId,
    email: user.email,
    role: user.role,
  });

  // Remove password hash from response
  const { passwordHash: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    tokens,
  };
}

/**
 * Get user from JWT token
 */
export async function getUserFromToken(
  token: string
): Promise<User | null> {
  try {
    const payload = await verifyToken(token);

    if (payload.type !== 'access') {
      return null;
    }

    const user = await db.user.findFirst({
      where: { id: payload.userId },
      include: { org: true, department: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Register new user (for invitation acceptance)
 */
export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
  orgId: string;
  role: UserRole;
  deptId?: string;
}): Promise<AuthResult | null> {
  // Validate password
  const validation = validatePassword(data.password);
  if (!validation.valid) {
    throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
  }

  // Check if user already exists
  const existingUser = await db.user.findFirst({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error('User already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await db.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name,
      orgId: data.orgId,
      role: data.role,
      deptId: data.deptId,
      status: UserStatus.ACTIVE,
    },
    include: { org: true },
  });

  // Generate tokens
  const tokens = await generateTokenPair({
    userId: user.id,
    orgId: user.orgId,
    email: user.email,
    role: user.role,
  });

  // Remove password hash from response
  const { passwordHash: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    tokens,
  };
}

export { generateTokenPair, verifyToken, hashPassword, verifyPassword, validatePassword };
