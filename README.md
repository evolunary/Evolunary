# Evolunary Framework

**Evolutionary Logic for Distributed Autonomous Agents**

![Evolunary Banner](banner.png)

---

## Overview

**Evolunary** is a TypeScript-powered agent framework for building distributed, state-driven AI entities capable of autonomous evolution, verifiable behavior, and collaborative problem-solving. At its core, Evolunary combines secure cryptographic state verification, dynamic persona development, and multi-agent coordination all guided by a cyclical behavioral model influenced by natural rhythms.

Whether you're designing persistent AI companions, logic-driven bots, or multi-agent swarms, Evolunary offers a flexible, proof-based foundation to scale intelligent behavior with clarity and trust.

---

## Core Capabilities

- **Cryptographic State Transitions**  
  All agent changes are recorded with digitally signed state hashes and Merkle proofs, ensuring traceable and tamper-resistant logs.

- **Behavioral Phase System**  
  Agents adapt their logic according to configurable cycles (e.g., lunar phases), enabling rhythm-based evolution and lifecycle modeling.

- **Persona Memory Engine**  
  Agents develop distinct personas based on historical data, goals, and customizable traits enabling persistent, evolving behavior.

- **Modular Rule Logic**  
  Define adaptive rule sets per agent or agent group. Logic updates dynamically based on internal state or external data.

- **Swarm Coordination**  
  Build and orchestrate fleets of agents that cooperate on shared objectives or respond to real-world signals together.

- **External Data Integration**  
  Pull structured knowledge from APIs or feeds to inform agent decision-making and environmental awareness.

- **Visualized Evolution**  
  Optional terminal-based logs for inspecting agent transitions and transformations in real time.

---

## Getting Started

### Prerequisites

```bash

# Requires Node.js v18 or later

node -v

# Install all dependencies

npm install
```

### Configuration

Create a `.env` file with the following keys:

```env
POSTGRES_URL=your_postgres_connection_string
CLAUDE_API_KEY=your_anthropic_api_key
```

### Quickstart Example

```ts
// Instantiate a new Evolunary agent
const agent = new EvolunaryAgent("agent_id", "session_id", privateKeyHex);

// Begin session with a base persona
await agent.start(defaultPersona);

// Access live state and behavioral history
agent.getCurrentState();
agent.getEvolutionHistory();
```

---

## State Transition Security

Every behavior update is cryptographically validated using the following schema:

```ts
interface Proof {
  stateHash: string; // SHA-256 hash of current state
  prevHash: string; // Link to prior state
  merkleRoot: string; // Root of Merkle tree snapshot
  merkleProof: string[]; // Merkle path for inclusion verification
  signature: string; // Agent's digital signature
  timestamp: number; // Transition time (UTC)
}
```

This guarantees a provable, auditable agent history.

---

## Persona Development System

Agent personas evolve via a modular state object that tracks identity traits and cognitive patterns:

```ts
interface PersonaState {
  personalityTraits: string[];
  goals: string[];
  interests: string[];
  background: string[];
  skills: string[];
  lore: string[];
  memories: string[];
  learnings: string[];
  patterns: string[];
  values: string[];
  prompt: string;
}
```

Personas adapt over time, guided by environmental inputs, logical milestones, and cyclic phases.

---

## Database Schema

Evolunary uses PostgreSQL for persistent tracking of agent activity and persona states:

- **`persona_states`**: Records detailed persona traits and transitions.
- **`state_logs`**: Stores cryptographic proof objects and timestamped transition metadata.

---

## Contributing

We welcome contributors to help shape Evolunary's future.

1. Fork this repo
2. Create a feature branch
3. Make your changes
4. Push to your fork
5. Submit a pull request

---

## Testing

To run unit and integration tests:

```bash
npm test
```

---

## License

MIT License see the [LICENSE](./LICENSE) file for full details.
