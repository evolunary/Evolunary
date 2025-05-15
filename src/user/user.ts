/**
 * Evolunary: Identity module for wallet-authenticated users.
 * Handles creation, lookup, updates, and removal of user records.
 */

import sql from '../utils/sql';

export interface User {
  id: string;
  username: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  walletAddress: string;
  role: 'user';
  createdAt: Date;
  updatedAt: Date;
}

export async function createUser(user: User): Promise<User> {
  const result = await sql<User[]>`
    INSERT INTO users (
      id,
      username,
      full_name,
      bio,
      avatar_url,
      wallet_address,
      role,
      created_at,
      updated_at
    ) VALUES (
      ${user.id},
      ${user.username},
      ${user.fullName},
      ${user.bio},
      ${user.avatarUrl},
      ${user.walletAddress},
      ${user.role},
      ${user.createdAt},
      ${user.updatedAt}
    ) RETURNING *
  `;
  return result[0];
}

export async function getUser(id: string): Promise<User | null> {
  const result = await sql<User[]>`
    SELECT * FROM users WHERE id = ${id}
  `;
  return result[0] || null;
}

export async function getUserByWallet(walletAddress: string): Promise<User | null> {
  const result = await sql<User[]>`
    SELECT * FROM users WHERE wallet_address = ${walletAddress}
  `;
  return result[0] || null;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  const fields = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ${value}`);
    }
  }

  fields.push(`updated_at = NOW()`);

  const result = await sql<User[]>`
    UPDATE users 
    SET ${sql(fields.join(', '))}
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0];
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM users WHERE id = ${id}
  `;
  return result.count > 0;
}

export async function listUsers(filter?: Partial<User>): Promise<User[]> {
  if (!filter) {
    return await sql<User[]>`
      SELECT * FROM users ORDER BY created_at DESC
    `;
  }

  const conditions = [];

  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined) {
      conditions.push(`${key} = ${value}`);
    }
  }

  return await sql<User[]>`
    SELECT * FROM users
    WHERE ${sql(conditions.join(' AND '))}
    ORDER BY created_at DESC
  `;
}
