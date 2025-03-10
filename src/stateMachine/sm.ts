/**
 * Evolunary Agent State Machine
 * 
 * Core logic for managing agent state transitions, Merkle-based verification,
 * cryptographic signatures, and persistent logging for behavioral trust.
 */

import { createHash, createPrivateKey, createSign, createVerify } from 'crypto';
import { MerkleTree } from 'merkletreejs';
import { StateMachineLogger } from './logger';
import SHA256 from 'crypto-js/sha256';
import sql from '../utils/sql';

/**
 * AgentState defines the operational phases in an Evolunary agent’s lifecycle.
 * These map the transition flow of logic, execution, and verification.
 */
export type AgentState = 
  'IDLE' |
  'INIT' |
  'GOAL_PARSE' |
  'PLANNING' |
  'EXECUTING' |
  'VALIDATING' |
  'REPORTING' |
  'COMPLETED' |
  'ERROR' |
  'TERMINATED';

/** Complete list of all agent states, useful for validation and state mapping */
export const AgentStates: AgentState[] = [
  'IDLE', 'INIT', 'GOAL_PARSE', 'PLANNING', 'EXECUTING',
  'VALIDATING', 'REPORTING', 'COMPLETED', 'ERROR', 'TERMINATED'
];

/**
 * Describes a transition from one state to another, along with context.
 */
export interface StateTransition {
  from: AgentState;
  to: AgentState;
  action: string;
  params: any;
}

/**
 * Defines a triggerable state transition operation.
 */
export interface StateTransitionAction {
  action: string;
  params: any;
}

/**
 * Verifiable proof of a state change, using cryptographic signatures and Merkle roots.
 */
export interface Proof {
  stateHash: string;
  prevHash: string;
  merkleRoot: string;
  merkleProof: string[];
  signature: string;
  timestamp: number;
}

/**
 * Defines hooks and logic handlers for a specific state.
 */
export interface StateHandler {
  entry?: (data?: any) => Promise<StateTransition>;
  exit?: (data?: any) => Promise<StateTransition>;
  actions?: Record<string, (data: any) => Promise<StateTransition>>;
}

/**
 * Defines valid next states for each state in the Evolunary graph.
 */
const validTransitions: Record<AgentState, AgentState[]> = {
  IDLE: ['INIT', 'ERROR', 'TERMINATED'],
  INIT: ['GOAL_PARSE', 'ERROR', 'TERMINATED', 'IDLE'],
  GOAL_PARSE: ['PLANNING', 'ERROR', 'TERMINATED', 'IDLE'],
  PLANNING: ['PLANNING', 'EXECUTING', 'ERROR', 'TERMINATED', 'IDLE'],
  EXECUTING: ['EXECUTING', 'VALIDATING', 'REPORTING', 'ERROR', 'TERMINATED', 'IDLE'],
  VALIDATING: ['VALIDATING', 'COMPLETED', 'REPORTING', 'EXECUTING', 'ERROR', 'TERMINATED', 'IDLE'],
  REPORTING: ['VALIDATING', 'REPORTING', 'COMPLETED', 'ERROR', 'TERMINATED', 'IDLE'],
  COMPLETED: ['TERMINATED', 'IDLE'],
  ERROR: ['TERMINATED', 'IDLE'],
  TERMINATED: []
};

/**
 * Foundation class for Evolunary agents.
 * Tracks state history, constructs Merkle trees, and generates verifiable proofs.
 */
class BaseState {
  protected stateHistory: string[] = [];
  protected merkleTree: MerkleTree;
  protected id: string;
  protected sessionId: string;
  protected privateKey: string;

  constructor(id: string, sessionId: string, privateKey: string) {
    this.id = id;
    this.sessionId = sessionId;
    this.privateKey = privateKey;
    this.merkleTree = new MerkleTree([], SHA256);
  }

  protected hashState(state: StateTransition): string {
    const encoded = JSON.stringify({
      timestamp: Date.now(),
      from: state.from,
      to: state.to,
      action: state.action,
      params: state.params
    });
    return SHA256(encoded).toString();
  }

  protected generateProof(state: StateTransition): Proof {
    const stateHash = this.hashState(state);
    this.stateHistory.push(stateHash);

    const leaves = [...this.stateHistory];
    this.merkleTree = new MerkleTree(leaves, SHA256);

    const merkleRoot = this.merkleTree.getHexRoot();
    const merkleProof = this.merkleTree.getHexProof(stateHash);

    return {
      stateHash,
      prevHash: this.stateHistory[this.stateHistory.length - 2] || '',
      merkleRoot,
      merkleProof,
      signature: this.sign(stateHash),
      timestamp: Date.now()
    };
  }

  private sign(hash: string): string {
    const key = createPrivateKey({
      key: Buffer.from(this.privateKey, 'hex'),
      format: 'der',
      type: 'pkcs8'
    });
    const signer = createSign('SHA256');
    signer.update(hash);
    return signer.sign(key, 'hex');
  }

  public verifySignature(hash: string, signature: string, publicKey: string): boolean {
    const verifier = createVerify('SHA256');
    verifier.update(hash);
    return verifier.verify(publicKey, Buffer.from(signature, 'hex'));
  }

  protected async broadcast(data: {
    agentId: string;
    sessionId: string;
    fromState: string;
    toState: string;
    action: string;
    proof: Proof;
  }): Promise<void> {
    await sql`
      INSERT INTO execution_logs (agent_id, session_id, from_state, to_state, action, proof)
      VALUES (
        ${data.agentId},
        ${data.sessionId},
        ${data.fromState},
        ${data.toState},
        ${data.action},
        ${sql.json({
          stateHash: data.proof.stateHash,
          prevHash: data.proof.prevHash,
          merkleRoot: data.proof.merkleRoot,
          merkleProof: data.proof.merkleProof,
          signature: data.proof.signature,
          timestamp: data.proof.timestamp
        })}
      )
    `;
  }
}

/**
 * StateNode represents a graph node in the agent’s state machine.
 */
export interface StateNode {
  state: AgentState;
  transitions: Map<AgentState, StateTransition>;
}

/**
 * Evolunary Agent State Machine
 * Orchestrates valid state transitions, cryptographic verification, and persistent logging.
 */
export class AgentStateMachine extends BaseState {
  private currentState: AgentState = 'INIT';
  private stateNodes: Map<AgentState, StateNode> = new Map();
  private logger: StateMachineLogger<AgentState>;

  constructor(id: string, sessionId: string, privateKey: string, logger?: StateMachineLogger<AgentState>) {
    super(id, sessionId, privateKey);
    this.logger = logger || new StateMachineLogger<AgentState>();
    this.initializeStates();
  }

  private initializeStates(): void {
    AgentStates.forEach(state => {
      this.stateNodes.set(state, { state, transitions: new Map() });
    });

    Object.entries(validTransitions).forEach(([from, toList]) => {
      const node = this.stateNodes.get(from as AgentState);
      if (!node) return;
      toList.forEach(to => {
        node.transitions.set(to, {
          from: from as AgentState,
          to,
          action: '',
          params: null
        });
      });
    });
  }

  /**
   * Executes a valid state transition.
   * Verifies legality, logs proof, and persists event to storage.
   */
  async transitionTo(state: AgentState, action: string, data?: any): Promise<Proof> {
    const currentNode = this.stateNodes.get(this.currentState);
    if (!currentNode || !currentNode.transitions.has(state)) {
      throw new Error(`Invalid transition: ${this.currentState} → ${state}`);
    }

    const proof = this.generateProof({
      from: this.currentState,
      to: state,
      action,
      params: data
    });

    this.logger.logTransition(this.id, this.sessionId, this.currentState, state, action, proof);

    await this.broadcast({
      agentId: this.id,
      sessionId: this.sessionId,
      fromState: this.currentState,
      toState: state,
      action,
      proof
    });

    this.currentState = state;
    return proof;
  }

  /** Returns next valid states for current context */
  getAvailableTransitions(): AgentState[] {
    const node = this.stateNodes.get(this.currentState);
    return node ? Array.from(node.transitions.keys()) : [];
  }

  /** Returns the current operational state */
  getCurrentState(): AgentState {
    return this.currentState;
  }

  /** Returns formatted transition history */
  getLogs(): string {
    return this.logger.getLogs(this.sessionId);
  }
}
