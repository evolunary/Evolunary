/**
 * Evolunary Background Job Queue Manager
 * @module utils/boss
 *
 * Initializes and manages asynchronous job execution using pg-boss.
 * Used to coordinate background tasks and deferred agent workflows.
 */

import PgBoss from "pg-boss";

/**
 * Global instance of pg-boss for job management
 * Uses the POSTGRES_URL environment variable for database connection
 */
export const boss = new PgBoss(process.env.POSTGRES_URL);

/**
 * Start the Evolunary job queue system
 * Ensures readiness to process queued agent operations and scheduled tasks
 */
await boss.start();
