/**
 * Evolunary Swarm Agent Type Definitions
 * Shared type contracts for agent state tracking and event logging
 * @module swarm/types
 */

/**
 * Lifecycle status for an Evolunary subagent
 */
export type AgentStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

/**
 * Persistent snapshot of an agent’s current state
 */
export interface SwarmAgentState {
    id: string;                         // Unique agent identifier
    userId: string;                     // Owner/user that initialized the agent
    status: AgentStatus;               // Current operational state
    lastActive: Date;                  // Timestamp of last heartbeat or interaction
    lastError?: string;                // Last recorded error (if any)
    metadata: Record<string, any>;     // Custom agent metadata (e.g. persona traits, task tags)
    createdAt: Date;                   // Time of initial registration
    updatedAt: Date;                   // Time of last state update
}

/**
 * Structured log entry from an agent’s runtime behavior
 */
export interface SwarmLog {
    id: string;                         // Unique log entry ID
    agentId: string;                    // Associated agent
    type: 'info' | 'error' | 'warning' | 'debug';  // Log severity
    message: string;                   // Human-readable message
    metadata?: Record<string, any>;    // Optional data payload (stack trace, config, etc.)
    timestamp: Date;                   // When the event was logged
}
