/**
 * Evolunary State Persistence Layer
 * Handles database I/O for swarm agent lifecycle, logs, and health status
 * @module persistence
 */

import sql from '../utils/sql';
import { randomBytes } from 'crypto';
import { SwarmAgentState, SwarmLog, AgentStatus } from './types';

/**
 * Evolunary agent state manager
 * Persists lifecycle metadata and logging for all active subagents
 */
export class SwarmPersistence {
    /**
     * Create or update persistent record of an agent's current state
     */
    async upsertAgentState(state: Partial<SwarmAgentState> & { id: string }): Promise<void> {
        await sql`
            INSERT INTO swarm_agents ${sql(state)}
            ON CONFLICT (id) DO UPDATE
            SET ${sql(state)},
                updated_at = NOW()
        `;
    }

    /**
     * Fetch current state of a specific agent
     */
    async getAgentState(agentId: string): Promise<SwarmAgentState | null> {
        const [state] = await sql<SwarmAgentState[]>`
            SELECT * FROM swarm_agents WHERE id = ${agentId}
        `;
        return state || null;
    }

    /**
     * Retrieve all agents that are currently booting or operational
     */
    async getActiveAgents(): Promise<SwarmAgentState[]> {
        return await sql<SwarmAgentState[]>`
            SELECT * FROM swarm_agents 
            WHERE status IN ('starting', 'running')
            ORDER BY created_at DESC
        `;
    }

    /**
     * Append diagnostic or lifecycle event to agent log
     */
    async addLog(log: Omit<SwarmLog, 'id' | 'timestamp'>): Promise<void> {
        await sql`
            INSERT INTO swarm_logs ${sql({
                id: randomBytes(16).toString('hex'),
                ...log,
                timestamp: new Date()
            })}
        `;
    }

    /**
     * Retrieve log history for a given agent within a time range
     */
    async getAgentLogs(
        agentId: string,
        from: Date,
        to: Date = new Date()
    ): Promise<SwarmLog[]> {
        return await sql<SwarmLog[]>`
            SELECT * FROM swarm_logs
            WHERE agent_id = ${agentId}
            AND timestamp BETWEEN ${from} AND ${to}
            ORDER BY timestamp DESC
        `;
    }

    /**
     * Update agent's status and optionally log error details
     */
    async updateAgentStatus(
        agentId: string,
        status: AgentStatus,
        error?: string
    ): Promise<void> {
        await sql`
            UPDATE swarm_agents
            SET status = ${status},
                last_active = NOW(),
                last_error = ${error},
                updated_at = NOW()
            WHERE id = ${agentId}
        `;
    }
}
