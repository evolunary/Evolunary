import sql from '../utils/sql';
import { randomBytes } from 'crypto';
import { Agent } from './agent';
import { PersonaStateData } from './subagents/persona';

export async function createAgentForUser(
    userId: string,
    name: string,
    bio: string,
    profileImageURL: string,
    initialPersona: PersonaStateData,
    execution: Agent['execution'],
    learningConfig: Agent['learningConfig']
): Promise<Agent> {
    const [agent] = await sql<Agent[]>`
        INSERT INTO agents (
            id,
            user_id,
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
            ${randomBytes(16).toString('hex')},
            ${userId},
            ${name},
            ${bio},
            ${profileImageURL},
            ${''}, // Empty wallet address initially
            ${''}, // Empty contract address initially
            ${sql.json({ ...initialPersona })},
            ${sql.json(execution)},
            ${sql.json(learningConfig)},
            ${sql.json([])}, // Empty social links initially
            ${'active'}, // Default status
            NOW(),
            NOW()
        )
        RETURNING *
    `;
    return agent;
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