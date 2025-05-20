/**
 * Evolunary Agent Management API
 * Handles CRUD operations and message routing for Evolunary agents
 * @module routes/agents
 */

import { Router } from 'express';
import { authenticatedMust, AuthenticatedRequest } from '../auth/middleware';
import { createAgentForUser, getAgentsByUser, getAgentById } from '../agent/model';
import { swarmManager } from '../swarm';

const router = Router();

// Get all Evolunary agents for the authenticated user
router.get('/', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    try {
        const { userId } = req.user!;
        const agents = await getAgentsByUser(userId);

        const agentsWithStatus = agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            createdAt: agent.createdAt,
            activeInSwarm: swarmManager.isAgentActive(agent.id),
        }));

        res.json({ agents: agentsWithStatus });
    } catch (err) {
        res.status(500).json({ error: 'Could not retrieve Evolunary agents' });
    }
});

// Get a specific Evolunary agent by ID
router.get('/:id', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user!;

        const agent = await getAgentById(id, userId);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        res.json({
            agent: {
                ...agent,
                activeInSwarm: swarmManager.isAgentActive(agent.id),
            },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not retrieve Evolunary agent' });
    }
});

// Create a new Evolunary agent
router.post('/new', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    try {
        const { name, bio, profileImageURL, persona, execution, learningConfig } = req.body;
        const { userId } = req.user!;

        if (!name || !persona) {
            return res.status(400).json({ error: 'Agent name and persona config required' });
        }

        const agent = await createAgentForUser(
            userId,
            name,
            bio,
            profileImageURL,
            persona,
            execution,
            learningConfig
        );

        const autoStart = req.query.autoStart === 'true';
        if (autoStart) {
            await swarmManager.startAgent(agent);
        }

        res.json({
            message: 'Evolunary agent created',
            agent: {
                id: agent.id,
                name: agent.name,
                status: agent.status,
                createdAt: agent.createdAt,
                activeInSwarm: autoStart,
            },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not create Evolunary agent' });
    }
});

// Send a message to a specific Evolunary agent
router.post('/:id/chat', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const { userId } = req.user!;

        if (!message) return res.status(400).json({ error: 'Message is required' });

        const agent = await getAgentById(id, userId);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        if (!swarmManager.isAgentActive(agent.id)) {
            await swarmManager.startAgent(agent);
        }

        const response = await swarmManager.sendMessage(agent.id, {
            type: 'chat',
            content: message,
        });

        if (!response.success) throw new Error(response.error || 'Failed to process message');

        res.json({ response: response.response });
    } catch (err) {
        res.status(500).json({ error: 'Failed to chat with Evolunary agent' });
    }
});

export default router;
