/**
 * Evolunary Swarm Orchestration Module
 * Coordinates multi-threaded execution of Evolunary subagents and handles lifecycle logic.
 * Supports hot restart, agent message passing, and persistent state restoration.
 * @module evolunary/swarm
 */

import { PersonaSubAgent } from "src/agent/subagents/persona";
import { Worker } from 'worker_threads';
import path from 'path';
import { AgentMailbox, AgentMessage, MessageResponse } from './mailbox';
import { Agent, getAgentById } from '../agent/agent';
import { SwarmPersistence } from './persistence';
import { AgentStatus } from './types';

/**
 * Bootstraps a swarm of Evolunary subagents using a common persona configuration
 * Useful for simulating multi-agent learning environments or cooperative models
 *
 * @param privateKeyHex - Auth key shared across subagents
 * @param initialPersona - Common persona logic injected into each agent
 * @param numAgents - Number of agents to launch (default: 2)
 * @param agentPrefix - Optional naming prefix
 */
export async function startSwarm(
    privateKeyHex: string, 
    initialPersona: any,
    numAgents: number = 2,
    agentPrefix: string = "PERSONA_SUBAGENT"
) {
    const personas = Array.from({ length: numAgents }, (_, i) => {
        const agentName = i === 0 ? agentPrefix : `${agentPrefix}_${i}`;
        return new PersonaSubAgent(i.toString(), agentName, privateKeyHex);
    });

    return Promise.all(personas.map(persona => persona.start(initialPersona)));
}

/**
 * Evolunary SwarmManager
 * Handles dynamic launching, error recovery, message routing, and graceful shutdown
 * of all Evolunary agents running in worker threads.
 */
export class SwarmManager {
    private workers: Map<string, Worker>;
    private mailbox: AgentMailbox;
    private activeAgents: Set<string>;
    private persistence: SwarmPersistence;

    constructor() {
        this.workers = new Map();
        this.mailbox = new AgentMailbox();
        this.activeAgents = new Set();
        this.persistence = new SwarmPersistence();
    }

    async initialize(): Promise<void> {
        try {
            const activeAgents = await this.persistence.getActiveAgents();

            for (const agentState of activeAgents) {
                try {
                    const agent = await getAgentById(agentState.id, agentState.userId);
                    if (agent) {
                        await this.startAgent(agent);
                        await this.persistence.addLog({
                            agentId: agent.id,
                            type: 'info',
                            message: 'Agent restored after reboot'
                        });
                    }
                } catch (error) {
                    await this.persistence.addLog({
                        agentId: agentState.id,
                        type: 'error',
                        message: 'Failed to relaunch agent',
                        metadata: { error: error.message }
                    });
                }
            }
        } catch (error) {
            console.error('[SwarmManager] Initialization failure:', error);
        }
    }

    async startAgent(agent: Agent): Promise<void> {
        try {
            if (this.activeAgents.has(agent.id)) throw new Error('Agent already running');

            await this.persistence.upsertAgentState({
                id: agent.id,
                userId: agent.userId,
                status: 'starting',
                lastActive: new Date(),
                metadata: {}
            });

            const worker = new Worker(path.join(__dirname, 'worker.js'), {
                workerData: {
                    agentId: agent.id,
                    name: agent.name,
                    privateKeyHex: process.env.AGENT_PRIVATE_KEY,
                    persona: agent.initialPersona
                }
            });

            worker.on('message', async (message: any) => {
                if (message.type === 'ready') {
                    this.activeAgents.add(agent.id);
                    await this.persistence.updateAgentStatus(agent.id, 'running');
                } else if (message.messageId) {
                    this.mailbox.sendResponse(message.messageId, message);
                }
            });

            worker.on('error', async (error) => {
                console.error(`[Agent ${agent.id}] Worker error:`, error);
                await this.persistence.addLog({
                    agentId: agent.id,
                    type: 'error',
                    message: 'Worker thread crashed',
                    metadata: { error: error.message }
                });
                await this.stopAgent(agent.id);
            });

            worker.on('exit', async (code) => {
                if (code !== 0) {
                    await this.persistence.addLog({
                        agentId: agent.id,
                        type: 'warning',
                        message: `Exited with code ${code}`
                    });
                }
                await this.stopAgent(agent.id);
            });

            this.mailbox.registerAgent(agent.id);
            this.mailbox.onMessage(agent.id, (msg) => worker.postMessage(msg));
            this.workers.set(agent.id, worker);

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(async () => {
                    await this.persistence.updateAgentStatus(agent.id, 'error', 'Startup timeout');
                    reject(new Error('Startup timeout'));
                }, 30000);

                worker.once('message', (message) => {
                    if (message.type === 'ready') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });
        } catch (error) {
            await this.persistence.updateAgentStatus(agent.id, 'error', error.message);
            throw error;
        }
    }

    async stopAgent(agentId: string): Promise<void> {
        const worker = this.workers.get(agentId);
        if (worker) {
            worker.terminate();
            this.workers.delete(agentId);
            this.mailbox.unregisterAgent(agentId);
            this.activeAgents.delete(agentId);
        }
    }

    async sendMessage(agentId: string, message: AgentMessage): Promise<MessageResponse> {
        if (!this.activeAgents.has(agentId)) {
            throw new Error('Agent not active');
        }
        return await this.mailbox.sendMessage(agentId, message);
    }

    isAgentActive(agentId: string): boolean {
        return this.activeAgents.has(agentId);
    }

    getActiveAgentCount(): number {
        return this.activeAgents.size;
    }

    async shutdown(): Promise<void> {
        try {
            for (const agentId of this.activeAgents) {
                await this.persistence.addLog({
                    agentId,
                    type: 'info',
                    message: 'Shutting down'
                });
            }

            const stopPromises = Array.from(this.workers.keys()).map(agentId =>
                this.stopAgent(agentId)
            );
            await Promise.all(stopPromises);
        } catch (error) {
            console.error('[SwarmManager] Shutdown failure:', error);
        }
    }
}

export const swarmManager = new SwarmManager();
swarmManager.initialize().catch(console.error);
