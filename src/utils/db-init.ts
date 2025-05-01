import sql from './sql';

/**
 * Evolunary Database Bootstrap Module
 * @module database/init
 * 
 * Sets up required tables for users, agents, and swarm operations.
 */

export async function initializeDatabase() {
    try {
        await Promise.all([
            initUserTables(),
            initAgentTables(),
            initSwarmTables(),
        ]);
    } catch (error) {
        throw error;
    }
}

async function initUserTables() {
    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            wallet_address TEXT UNIQUE NOT NULL,
            bio TEXT,
            avatar_url TEXT,
            full_name TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            csrf_hash TEXT NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`;
}

async function initAgentTables() {
    await sql`
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            bio TEXT NOT NULL,
            profile_image_url TEXT NOT NULL,
            paired_wallet_address TEXT NOT NULL DEFAULT '',
            contract_address TEXT NOT NULL DEFAULT '',
            initial_persona JSONB NOT NULL,
            execution JSONB NOT NULL,
            learning_config JSONB NOT NULL,
            social_links JSONB NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_agents_created ON agents(created_at DESC)`;

    await sql`
        CREATE TABLE IF NOT EXISTS agent_personas (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
            session_id TEXT NOT NULL,
            version TEXT NOT NULL,
            node_level INTEGER NOT NULL,
            node_version INTEGER NOT NULL,
            personality_traits TEXT[] NOT NULL DEFAULT '{}',
            goals TEXT[] NOT NULL DEFAULT '{}',
            interests TEXT[] NOT NULL DEFAULT '{}',
            background TEXT[] NOT NULL DEFAULT '{}',
            skills TEXT[] NOT NULL DEFAULT '{}',
            lore TEXT[] NOT NULL DEFAULT '{}',
            memories TEXT[] NOT NULL DEFAULT '{}',
            learnings TEXT[] NOT NULL DEFAULT '{}',
            patterns TEXT[] NOT NULL DEFAULT '{}',
            values TEXT[] NOT NULL DEFAULT '{}',
            prompt TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_personas_agent ON agent_personas(agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_personas_version ON agent_personas(version)`;
}

async function initSwarmTables() {
    await sql`
        CREATE TABLE IF NOT EXISTS swarm_agents (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            status TEXT NOT NULL,
            last_active TIMESTAMP WITH TIME ZONE,
            last_error TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS swarm_logs (
            id TEXT PRIMARY KEY,
            agent_id TEXT REFERENCES swarm_agents(id),
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            metadata JSONB,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_swarm_agents_status ON swarm_agents(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_swarm_agents_user ON swarm_agents(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_swarm_logs_agent ON swarm_logs(agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_swarm_logs_timestamp ON swarm_logs(timestamp)`;
}
