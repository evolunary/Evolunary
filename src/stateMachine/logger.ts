/**
 * State machine logging module with formatted output and cryptographic verification
 * Provides structured logging for state transitions with ASCII art headers
 * @module stateMachine/logger
 */

import { Proof } from "./sm";

/**
 * ASCII art header template for log output
 * Displays system status, runtime info and verification data
 * 
 * @param status - Current operational status ("ACTIVE" | "OFFLINE")
 * @param date - ISO timestamp of log generation
 * @param signature - Cryptographic signature for log verification
 * @returns Formatted ASCII art header string
 */
const LOG_HEADER = `
_____  _____            _____ _    _ _               
|  __ \|  __ \     /\   / ____| |  | | |        /\    
| |  | | |__) |   /  \ | |    | |  | | |       /  \   
| |  | |  _  /   / /\ \| |    | |  | | |      / /\ \  
| |__| | | \ \  / ____ \ |____| |__| | |____ / ____ \ 
|_____/|_|  \_\/_/    \_\_____|\____/|______/_/    \_\

Distributed Rules for Agent Consensus in Unified Logic Applications
`

/**
 * Interface defining core logging functionality for state transitions
 * Provides structured logging of state changes with cryptographic proofs
 */
interface StateLogger<State extends string> {
    /**
     * Logs a state transition with associated metadata and proof
     * @param agentId - Unique identifier of the agent
     * @param sessionId - Current session identifier
     * @param from - Source state of transition
     * @param to - Destination state of transition
     * @param action - Action that triggered the transition
     * @param proof - Cryptographic proof of the transition
     */
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
 * Implementation of StateLogger interface for autonomous agent state machines
 * Provides secure logging with cryptographic verification and formatted output
 */
export class StateMachineLogger<State extends string> implements StateLogger<State> {
    /** Array storing chronological log entries */
    private logs: string[] = [];

    /**
     * Formats cryptographic signatures for readable output
     * Truncates long signatures while preserving verification capability
     * 
     * @param signature - Full cryptographic signature
     * @returns Formatted signature string with length indicator
     */
    formatSignature(signature: string) {
        const 
          startLength = 8,        // Length of preserved start section
          endLength = 8,          // Length of preserved end section
          separator = '...',      // Indicator for truncated section
          includeLength = true    // Whether to append total length
      
        if (!signature) return '';
        
        // Return full signature if shorter than truncation threshold
        if (signature.length <= startLength + endLength) {
          return signature;
        }
      
        const start = signature.substring(0, startLength);
        const end = signature.substring(signature.length - endLength);
        const formatted = `${start}${separator}${end}`;
        
        return includeLength ? `${formatted} (${signature.length})` : formatted;
    }

    /**
     * Logs a state transition with associated metadata and proof
     * Generates timestamped entries with formatted signatures
     * 
     * @param agentId - Unique identifier of the agent
     * @param sessionId - Current session identifier 
     * @param from - Source state of transition
     * @param to - Destination state of transition
     * @param action - Action that triggered the transition
     * @param proof - Cryptographic proof of the transition
     * @returns Formatted log entry string
     */
    logTransition(
      agentId: string,
      sessionId: string,
      from: State,
      to: State, 
      action: string,
      proof: Proof
    ): string {
        let log = `[${Date.now()}] ${agentId} ${sessionId} ${from}->${to}: ${action}; sig(${this.formatSignature(proof.signature)})`
        console.log(log);
        this.logs.push(log);
        return log
    }

    /**
     * Retrieves complete formatted logs for a session
     * Includes ASCII art header and chronological log entries
     * 
     * @param sessionId - Session identifier for log filtering
     * @returns Complete formatted log output as string
     */
    public getLogs(sessionId: string): string {
        return LOG_HEADER("ACTIVE", new Date().toISOString(), sessionId) + '\n' + this.logs.join('\n')
    }
}