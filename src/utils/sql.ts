/**
 * Evolunary SQL Utility
 * Establishes a configured PostgreSQL client for database operations
 * @module utils/sql
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Retrieves the PostgreSQL connection URL from environment variables.
 * Defaults to an empty string if not set (will fail gracefully on connection).
 */
const connectionString = process.env.POSTGRES_URL ?? "";

/**
 * Creates a postgres client instance with camelCase property mapping.
 * Used for consistent querying throughout Evolunary's backend.
 */
const sql = postgres(connectionString, {
  transform: postgres.camel
});

export default sql;
