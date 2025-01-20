import { KnowledgeSource } from "."
import { PersonaState, PersonaStateData } from "./subagents/persona"
import sql from '../utils/sql'

/**
 * Represents an autonomous agent in the system
 * 
 * An Agent is an AI-powered entity that can interact with users, learn from experiences,
 * and execute tasks based on its configuration. Each agent has a unique identity,
 * personality traits, and learning capabilities.
 */
export interface Agent {
    /** Unique identifier for the agent */
    id: string

    userId: string;

    /** Display name of the agent */
    name: string

    /** Brief description of the agent's purpose and characteristics */
    bio: string

    /** URL to the agent's profile/avatar image */
    profileImageURL: string

    /** Ethereum wallet address paired with this agent for transactions */
    pairedWalletAddress: string

    /** Smart contract address associated with this agent */
    contractAddress: string

    /** Initial personality state and traits of the agent */
    initialPersona: PersonaStateData

    /** 
     * Configuration for agent's task execution behavior
     */
    execution: {
        /** How often the agent performs actions (in milliseconds) */
        frequency: number
        /** Initial computational resources allocated to the agent */
        initialResourceAllocation: number
        /** Base prompt/instructions for task execution */
        prompt: string
    }

    /**
     * Configuration for agent's learning and adaptation capabilities
     */
    learningConfig: {
        /** Rate at which agent incorporates new information (0-1) */
        learningRate: number
        /** Maximum amount of historical information agent can retain */
        memoryCapacity: number
        /** Initial propensity to explore new information (0-1) */
        initialCuriosityRate: number
        /** Base prompt/instructions for learning behavior */
        prompt: string
    }

    // /** Sources of knowledge the agent can access and learn from */
    // knowledgeSources: KnowledgeSource[]

    /** 
     * Social media presence and connection points
     * Array of platform links where users can interact with the agent
     */
    socialLinks: {
        /** Supported social media platform */
        platform: "twitter" | "github" | "telegram" | "discord" | "other"
        /** URL to agent's profile on the platform */
        url: string
    }[]

    /** Timestamp when the agent was created */
    createdAt: Date

    /** Timestamp of last update to agent configuration */
    updatedAt: Date

    /** Current status of the agent */
    status: 'active' | 'inactive' | 'error';
}

/**
 * Creates a new agent in the database
 * @param agent - Agent configuration to create
 * @returns Created agent record
 */
export async function createAgent(agent: Agent): Promise<Agent> {
    let result = await sql<Agent[]>`
        INSERT INTO agents (
            id,
            name,
            bio,
            profile_image_url,
            paired_wallet_address,
            contract_address,
            initial_persona,
            execution,
            learning_config,
            social_links,
            status,
            created_at,
            updated_at
        ) VALUES (
            ${agent.id},
            ${agent.name},
            ${agent.bio},
            ${agent.profileImageURL},
            ${agent.pairedWalletAddress},
            ${agent.contractAddress},
            ${sql.json({ ...agent.initialPersona })},
            ${sql.json(agent.execution)},
            ${sql.json(agent.learningConfig)},
            ${sql.json(agent.socialLinks)},
            ${agent.status || 'active'},
            ${agent.createdAt},
            ${agent.updatedAt}
        ) RETURNING *
    `;
    
    return result[0];
}

export async function getAgentsByUser(userId: string): Promise<Agent[]> {
    return await sql<Agent[]>`
        SELECT * FROM agents 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
    `;
}

export async function getAgentById(id: string, userId: string): Promise<Agent | null> {
    const [agent] = await sql<Agent[]>`
        SELECT * FROM agents 
        WHERE id = ${id} AND user_id = ${userId}
    `;
    return agent || null;
} 

/**
 * Retrieves an agent by ID
 * @param id - Agent identifier
 * @returns Agent record if found
 */
export async function getAgent(id: string): Promise<Agent | null> {
    const results = await sql<Agent[]>`
        SELECT * FROM agents WHERE id = ${id}
    `;
    return results[0] || null;
}

/**
 * Updates an existing agent's configuration
 * @param id - Agent identifier
 * @param updates - Partial agent data to update
 * @returns Updated agent record
 */
export async function updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    const sets = [];
    const values = [];
    
    // Build dynamic SET clause
    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            if (typeof value === 'object') {
                sets.push(`${key} = ${sql.json({ ...value })}`);
            } else {
                sets.push(`${key} = ${value}`);
            }
        }
    }

    // Add updated_at timestamp
    sets.push(`updated_at = NOW()`);

    const result = await sql<Agent[]>`
        UPDATE agents 
        SET ${sql(sets.join(', '))}
        WHERE id = ${id}
        RETURNING *
    `;
    
    return result[0];
}

/**
 * Deletes an agent from the database
 * @param id - Agent identifier to delete
 * @returns Boolean indicating success
 */
export async function deleteAgent(id: string): Promise<boolean> {
    const result = await sql`
        DELETE FROM agents WHERE id = ${id}
    `;
    return result.count > 0;
}

/**
 * Lists all agents, optionally filtered by criteria
 * @param filter - Optional filter criteria
 * @returns Array of matching agents
 */
export async function listAgents(filter?: Partial<Agent>): Promise<Agent[]> {
    if (!filter) {
        return await sql`SELECT * FROM agents ORDER BY created_at DESC`;
    }

    const conditions = [];
    const values = [];

    // Build dynamic WHERE clause
    for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined) {
            if (typeof value === 'object') {
                conditions.push(`${key} @> ${sql.json({ ...value})}`);
            } else {
                conditions.push(`${key} = ${value}`);
            }
        }
    }

    return await sql<Agent[]>`
        SELECT * FROM agents 
        WHERE ${sql(conditions.join(' AND '))}
        ORDER BY created_at DESC
    `;
}

/**
 * Retrieves agents by wallet address
 * @param walletAddress - Ethereum wallet address
 * @returns Array of agents linked to the wallet
 */
export async function getAgentsByWallet(walletAddress: string): Promise<Agent[]> {
    return await sql<Agent[]>`
        SELECT * FROM agents 
        WHERE paired_wallet_address = ${walletAddress}
        ORDER BY created_at DESC
    `;
}

/**
 * Updates an agent's learning configuration
 * @param id - Agent identifier
 * @param learningConfig - New learning configuration
 * @returns Updated agent record
 */
export async function updateAgentLearning(
    id: string, 
    learningConfig: Agent['learningConfig']
): Promise<Agent> {
    const [updatedAgent] = await sql<Agent[]>`
        UPDATE agents 
        SET 
            learning_config = ${sql.json(learningConfig)},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
    `;
    return updatedAgent;
}

/**
 * Updates an agent's social links
 * @param id - Agent identifier
 * @param socialLinks - New social media links
 * @returns Updated agent record
 */
export async function updateAgentSocialLinks(
    id: string,
    socialLinks: Agent['socialLinks']
): Promise<Agent> {
    const [updatedAgent] = await sql<Agent[]>`
        UPDATE agents 
        SET 
            social_links = ${sql.json(socialLinks)},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
    `;
    return updatedAgent;
}
