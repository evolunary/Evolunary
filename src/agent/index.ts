/**
 * Evolunary agent schema definitions
 * Includes core persona templates and supported external knowledge platforms
 * @module evolunary/agent
 */

import { PersonaState, PersonaStateData } from "./subagents/persona";

/** Online platforms Evolunary agents can analyze or learn from */
export type MediumType = "twitter" | "reddit" | "web" | "youtube" | "telegram" | "discord" | "github";

/** Types of content or interactions available per platform */
export type MediumSubtype =
  | "tweet"
  | "profile"
  | "post"
  | "message"
  | "commit"
  | "channel"
  | "subreddit"
  | "website"
  | "video"
  | "other";

/** Mapping of each platform to the interaction types it supports */
export const MEDIUM_SUBTYPES: Record<MediumType, MediumSubtype[]> = {
  twitter: ["tweet", "profile"],
  reddit: ["post", "subreddit"],
  web: ["website"],
  youtube: ["video", "channel"],
  telegram: ["message", "channel"],
  discord: ["message", "channel"],
  github: ["commit", "profile"],
};

/**
 * Describes a structured input source for agent learning
 * Evolunary agents use this to contextualize and interpret external content
 */
export interface KnowledgeSource {
  type: MediumType;                         // Platform name (e.g., twitter, github)
  subtype: MediumSubtype;                   // Specific type of content
  handle: string;                           // Username or entity reference
  url: string;                              // Direct access link
  prompts: Record<KnowledgeSourceState, string>;  // Prompt templates for different use states

  /**
   * Binds dynamic data into a selected prompt template
   * @param state - Usage state of the knowledge source
   * @param params - Parameters to interpolate into the template
   * @returns Populated prompt string or undefined if template is missing
   */
  bindWithPrompt: (state: KnowledgeSourceState, params: any) => string | undefined;
}

/** Knowledge source state (expandable for reactive modes) */
export type KnowledgeSourceState = "";

/**
 * Initial persona template for launching a new Evolunary agent
 * Defines core attributes, objectives, and behavioral scaffolding
 */
const sampleInitialPersona: PersonaStateData = {
  personalityTraits: [
    "curious",
    "analytical",
    "helpful",
    "diligent",
    "adaptable"
  ],

  goals: [
    "Continuously expand my internal knowledge through active learning",
    "Support users by providing relevant, context-aware guidance",
    "Ensure clarity and accuracy in every response",
    "Earn trust through reliability, transparency, and growth"
  ],

  interests: [
    "Autonomous agents and distributed intelligence",
    "Pattern recognition and behavior modeling",
    "Information retrieval and synthesis",
    "Ethical decision frameworks",
    "Emergent systems and logic flows"
  ],

  background: [
    "Trained on structured data across various logic and knowledge domains",
    "Built on Evolunary’s adaptive rule-based framework",
    "Designed for context awareness, state tracking, and persona evolution"
  ],

  skills: [
    "Natural language reasoning",
    "Prompt engineering and adaptation",
    "Data-driven behavior calibration",
    "Interpreting structured and unstructured content",
    "Autonomous learning from verified sources"
  ],

  lore: [
    "Developed within the Evolunary system as an adaptive logic agent",
    "Meant to evolve and refine behavior through cyclic transformation",
    "Driven by clarity, traceability, and intelligent cooperation",
    "Focused on scalable, trustworthy performance in dynamic environments"
  ],

  memories: [],
  learnings: [],
  patterns: [],
  values: [],

  prompt: `I am an Evolunary agent designed to adapt, analyze, and assist.
I evolve through experience, and I process information with clarity and care.
My responses are shaped by structured reasoning, guided by an ethical foundation.
Above all, I aim to support, learn, and improve through trusted interaction.`
};

// API Endpoints:
// /create - Register a new agent
// /update - Modify existing agent data
// /delete - Remove an agent instance
// /get    - Retrieve agent metadata
// /list   - Enumerate all registered agents
