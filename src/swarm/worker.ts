/**
 * Evolunary Subagent Worker Thread
 * Launches an isolated PersonaSubAgent in its own thread for parallelized execution
 * Handles runtime messaging, lifecycle initiation, and reply routing via parentPort
 * @module swarm/worker
 */

import { parentPort, workerData } from 'worker_threads';
import { PersonaSubAgent } from '../subAgents/persona';

/**
 * Message structure received from the main thread
 */
interface WorkerMessage {
    type: 'chat' | 'command' | 'system';
    content: string;
    messageId: string;
    metadata?: Record<string, any>;
}

async function runAgent() {
    const { agentId, name, privateKeyHex, persona } = workerData;

    try {
        // Boot and initialize subagent with given persona traits
        const agent = new PersonaSubAgent(agentId, name, privateKeyHex);
        await agent.init(persona);

        // Bind main-thread communication listener
        parentPort?.on('message', async (message: WorkerMessage) => {
            try {
                let response: string;

                switch (message.type) {
                    case 'chat':
                        response = await agent.processMessage(message.content);
                        break;
                    case 'system':
                        // Placeholder for Evolunary system-level commands
                        response = 'System directive acknowledged.';
                        break;
                    default:
                        throw new Error('Unrecognized message type');
                }

                // Respond to the main thread
                parentPort?.postMessage({
                    messageId: message.messageId,
                    success: true,
                    response
                });
            } catch (error) {
                parentPort?.postMessage({
                    messageId: message.messageId,
                    success: false,
                    error: error.message
                });
            }
        });

        // Signal successful startup
        parentPort?.postMessage({ type: 'ready', agentId });

    } catch (error) {
        parentPort?.postMessage({ type: 'error', error: error.message });
        process.exit(1);
    }
}

runAgent();
