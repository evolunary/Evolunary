/**
 * Evolunary Agent Mailbox
 * Thread-safe pub/sub message system for Evolunary agent communication
 * Enables asynchronous messaging and response routing between swarm workers and main thread
 * @module evolunary/mailbox
 */

import { EventEmitter } from 'events';

export interface AgentMessage {
  type: 'chat' | 'command' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

export interface MessageResponse {
  success: boolean;
  response?: string;
  error?: string;
}

/**
 * AgentMailbox acts as the internal message bus between Evolunary agents and their handlers.
 * It uses a basic publish/subscribe pattern to route messages across threads and return results.
 */
export class AgentMailbox {
  private emitter: EventEmitter;
  private messageQueue: Map<string, AgentMessage[]>;
  private responseCallbacks: Map<string, (response: MessageResponse) => void>;

  constructor() {
    this.emitter = new EventEmitter();
    this.messageQueue = new Map();
    this.responseCallbacks = new Map();
  }

  /**
   * Register an agent with the mailbox system.
   * Enables message delivery to the agent's communication channel.
   * @param agentId - Unique identifier for the agent
   */
  registerAgent(agentId: string): void {
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(agentId, []);
    }
  }

  /**
   * Send a message to a specific agent. Waits for response via internal callback system.
   * @param agentId - Target agent ID
   * @param message - Structured message payload
   * @returns A promise that resolves with the agent's response
   */
  async sendMessage(agentId: string, message: AgentMessage): Promise<MessageResponse> {
    return new Promise((resolve) => {
      const messageId = `${agentId}_${Date.now()}_${Math.random()}`;
      this.responseCallbacks.set(messageId, resolve);
      this.emitter.emit(`message:${agentId}`, { ...message, messageId });
    });
  }

  /**
   * Subscribe to inbound messages for a specific agent.
   * Used by worker threads to receive requests from the main process.
   * @param agentId - Target agent ID
   * @param callback - Function to invoke when a message is delivered
   */
  onMessage(agentId: string, callback: (message: AgentMessage & { messageId: string }) => void): void {
    this.emitter.on(`message:${agentId}`, callback);
  }

  /**
   * Post a response to a previously sent message, fulfilling the awaiting callback.
   * Used by agents after processing a command or request.
   * @param messageId - Unique message identifier
   * @param response - Response payload to return to sender
   */
  sendResponse(messageId: string, response: MessageResponse): void {
    const callback = this.responseCallbacks.get(messageId);
    if (callback) {
      callback(response);
      this.responseCallbacks.delete(messageId);
    }
  }

  /**
   * Unregister an agent from the mailbox system.
   * Removes all active listeners and queued messages.
   * @param agentId - Target agent ID
   */
  unregisterAgent(agentId: string): void {
    this.messageQueue.delete(agentId);
    this.emitter.removeAllListeners(`message:${agentId}`);
  }
}
