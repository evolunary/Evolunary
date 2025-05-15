/**
 * Evolunary: Token and session lifecycle manager.
 * Handles generation, verification, and refresh of access and CSRF tokens.
 */

import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import sql from '../utils/sql';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  csrfHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const {
  JWT_ACCESS_SECRET = randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET = randomBytes(32).toString('hex'),
  JWT_ACCESS_EXPIRES = '15m',
  JWT_REFRESH_EXPIRES = '604800000',
  CSRF_SECRET = randomBytes(32).toString('hex')
} = process.env;

function generateCsrfPair() {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token + CSRF_SECRET).digest('hex');
  return { token, hash };
}

export function validateCsrfToken(token: string, hash: string): boolean {
  const check = createHash('sha256').update(token + CSRF_SECRET).digest('hex');
  return check === hash;
}

export async function createTokenPair(userId: string, walletAddress: string): Promise<TokenPair> {
  const accessToken = jwt.sign(
    { userId, walletAddress, type: 'access' },
    JWT_ACCESS_SECRET,
    { expiresIn: parseInt(JWT_ACCESS_EXPIRES) }
  );

  const refreshToken = jwt.sign(
    { userId, walletAddress, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: parseInt(JWT_REFRESH_EXPIRES) }
  );

  const { token: csrfToken, hash: csrfHash } = generateCsrfPair();
  await storeRefreshToken(userId, refreshToken, csrfHash);

  return { accessToken, refreshToken, csrfToken };
}

async function storeRefreshToken(userId: string, token: string, csrfHash: string) {
  const tokenHash = jwt.sign({ token }, JWT_REFRESH_SECRET);
  const expiresAt = new Date(Date.now() + parseInt(JWT_REFRESH_EXPIRES));

  await sql`
    INSERT INTO refresh_tokens (
      id, user_id, token_hash, csrf_hash, expires_at, created_at
    ) VALUES (
      ${randomBytes(16).toString('hex')},
      ${userId},
      ${tokenHash},
      ${csrfHash},
      ${expiresAt},
      NOW()
    )
  `;
}

export async function refreshAccessToken(refreshToken: string, csrfToken: string): Promise<TokenPair> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
      userId: string;
      walletAddress: string;
      type: string;
    };

    if (decoded.type !== 'refresh') throw new Error('Wrong token type');

    const tokenHash = jwt.sign({ token: refreshToken }, JWT_REFRESH_SECRET);
    const rows = await sql<RefreshToken[]>`
      SELECT * FROM refresh_tokens
      WHERE token_hash = ${tokenHash}
      AND user_id = ${decoded.userId}
      AND expires_at > NOW()
    `;

    if (!rows.length || !validateCsrfToken(csrfToken, rows[0].csrfHash)) {
      throw new Error('CSRF validation failed');
    }

    await sql`
      DELETE FROM refresh_tokens
      WHERE token_hash = ${tokenHash}
    `;

    return await createTokenPair(decoded.userId, decoded.walletAddress);
  } catch {
    throw new Error('Refresh failed');
  }
}

export async function invalidateAllTokens(userId: string): Promise<void> {
  await sql`
    DELETE FROM refresh_tokens
    WHERE user_id = ${userId}
  `;
}

export async function verifyTokens(accessToken: string, csrfToken: string): Promise<{ userId: string; walletAddress: string }> {
  try {
    const decoded = jwt.verify(accessToken, JWT_ACCESS_SECRET) as {
      userId: string;
      walletAddress: string;
      type: string;
    };

    if (decoded.type !== 'access') throw new Error('Wrong token type');

    const result = await sql<RefreshToken[]>`
      SELECT csrf_hash FROM refresh_tokens
      WHERE user_id = ${decoded.userId}
      AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!result.length || !validateCsrfToken(csrfToken, result[0].csrfHash)) {
      throw new Error('CSRF validation failed');
    }

    return { userId: decoded.userId, walletAddress: decoded.walletAddress };
  } catch {
    throw new Error('Access validation failed');
  }
}
