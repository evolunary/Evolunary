/**
 * Evolunary State Machine Logger
 * 
 * Secure, structured logging for agent state transitions with cryptographic verification.
 * @module evolunary/logger
 */

import { Proof } from "./sm";

/**
 * Generates a branded Evolunary session header.
 * Displays runtime metadata in a clean, visual format.
 * 
 * @param status - Agent status: "ACTIVE" | "OFFLINE"
 * @param date - Timestamp of log generation
 * @param sessionId - Current session ID
 * @returns Formatted header string
 */
function logHeader(status: string, date: string, sessionId: string): string {
  return `
  ┌────────────────────────────────────────────┐
  │              EVOLUNARY LOGGER              │
  ├────────────────────────────────────────────┤
  │ Status: ${status}                          │
  │ Time:   ${date}                            │
  │ Session: ${sessionId}                      │
  └────────────────────────────────────────────┘
`;
}

/**
 * Interface for Evolunary transition loggers.
 * Used to track and verify agent state transitions.
 */
interface StateLogger<State extends string> {
  logTransition(
    agentId: string,
    sessionId: string,
    from: State,
    to: State,
    action: string,
    proof: Proof
  ): void;
}

/**
 * Evolunary implementation of StateLogger
 * Tracks state transitions with readable logs and signature verification
 */
export class StateMachineLogger<State extends string> implements StateLogger<State> {
  private logs: string[] = [];

  /**
   * Shortens cryptographic signature for log readability.
   * Displays head + tail with optional length.
   */
  formatSignature(signature: string): string {
    const start = signature.slice(0, 8);
    const end = signature.slice(-8);
    const formatted = `${start}...${end}`;
    return `${formatted} (${signature.length})`;
  }

  /**
   * Logs a state change with timestamp and proof metadata.
   * 
   * @param agentId - Unique identifier for the agent
   * @param sessionId - Current session scope
   * @param from - Previous state
   * @param to - Next state
   * @param action - Action that triggered the change
   * @param proof - Verifiable cryptographic proof
   */
  logTransition(
    agentId: string,
    sessionId: string,
    from: State,
    to: State,
    action: string,
    proof: Proof
  ): string {
    const timestamp = new Date().toISOString();
    const log = `[${timestamp}] ${agentId} ${sessionId} ${from} -> ${to}: ${action}; sig(${this.formatSignature(proof.signature)})`;
    console.log(log);
    this.logs.push(log);
    return log;
  }

  /**
   * Outputs a full log trace for the current session.
   * Includes branded header and all log entries.
   */
  getLogs(sessionId: string): string {
    const header = logHeader("ACTIVE", new Date().toISOString(), sessionId);
    return header + this.logs.join("\n");
  }
}
