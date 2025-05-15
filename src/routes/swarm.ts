/**
 * Evolunary Swarm Routes
 * Manages real-time deployment and lifecycle of agents across the swarm layer
 * @module routes/swarm
 */

import { Router } from 'express';
import { authenticatedMust, AuthenticatedRequest } from '../auth/middleware';
import { swarmManager } from '../swarm';
import { getAgentsByUser, getAgentById } from '../agent/model';

const router = Router();

// GET /swarm/status
// Returns current swarm presence and state of all user-linked agents
router.get('/status', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    const { userId } = req.user!;
    const agents = await getAgentsByUser(userId);

    const statuses = await Promise.all(agents.map(async (agent) => ({
        id: agent.id,
        name: agent.name,
        status: swarmManager.isAgentActive(agent.id) ? 'running' : 'stopped',
        activeInSwarm: swarmManager.isAgentActive(agent.id)
    })));

    res.json({ agents: statuses });
});

// POST /swarm/start
// Starts all inactive agents in the swarm
router.post('/start', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    const { userId } = req.user!;
    const agents = await getAgentsByUser(userId);

    const started = (await Promise.all(
        agents.map(async (agent) => {
            if (!swarmManager.isAgentActive(agent.id)) {
                await swarmManager.startAgent(agent);
                return agent.id;
            }
        })
    )).filter(Boolean);

    res.json({ message: 'Swarm started', startedAgents: started });
});

// POST /swarm/stop
// Halts all active agents in the swarm
router.post('/stop', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    const { userId } = req.user!;
    const agents = await getAgentsByUser(userId);

    const stopped = (await Promise.all(
        agents.map(async (agent) => {
            if (swarmManager.isAgentActive(agent.id)) {
                await swarmManager.stopAgent(agent.id);
                return agent.id;
            }
        })
    )).filter(Boolean);

    res.json({ message: 'Swarm stopped', stoppedAgents: stopped });
});

// 🚀 POST /swarm/start/:agentId
// Starts a single agent instance by ID
router.post('/start/:agentId', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    const { agentId } = req.params;
    const { userId } = req.user!;

    const agent = await getAgentById(agentId, userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (swarmManager.isAgentActive(agentId)) {
        return res.status(400).json({ error: 'Agent already running', agentId, status: 'running' });
    }

    await swarmManager.startAgent(agent);

    res.json({ message: 'Agent started', agentId, status: 'running' });
});

// POST /swarm/stop/:agentId
// Halts a specific agent instance by ID
router.post('/stop/:agentId', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    const { agentId } = req.params;
    const { userId } = req.user!;

    const agent = await getAgentById(agentId, userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (!swarmManager.isAgentActive(agentId)) {
        return res.status(400).json({ error: 'Agent already stopped', agentId, status: 'stopped' });
    }

    await swarmManager.stopAgent(agentId);

    res.json({ message: 'Agent stopped', agentId, status: 'stopped' });
});

export default router;
