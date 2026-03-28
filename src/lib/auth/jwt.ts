import { SignJWT, jwtVerify } from 'jose';

const DEFAULT_JWT_SECRET = 'your-secret-key-change-in-production';
const jwtSecretRaw = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

if (
  process.env.NODE_ENV === 'production' &&
  jwtSecretRaw === DEFAULT_JWT_SECRET
) {
  console.warn(
    '[security] JWT_SECRET is unset or default — set a strong, random JWT_SECRET in production.'
  );
}

const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

const JWT_ACCESS_EXPIRES_IN = '8h';
const JWT_REFRESH_EXPIRES_IN = '30d';

export interface JWTPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

/**
 * Generate access token
 */
export async function generateAccessToken(payload: Omit<JWTPayload, 'type'>) {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_ACCESS_EXPIRES_IN)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(payload: Omit<JWTPayload, 'type'>) {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_REFRESH_EXPIRES_IN)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as JWTPayload;
}

/**
 * Generate token pair
 */
export async function generateTokenPair(payload: Omit<JWTPayload, 'type'>) {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_ACCESS_EXPIRES_IN,
  };
}
