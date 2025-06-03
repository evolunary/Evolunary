/**
 * This module implements Evolunary's adaptive persona system.
 * It includes agent state management, versioned memory trees, and AI-guided evolution.
 */

import { StateMachine } from "../sm";
import { TreeNodeJSON, TreeStateJSON, VersionedTree } from "../tree";
import { prompt } from "../../utils/llm";
import { generateKeyPairSync, randomUUID } from "crypto";

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sql from "../../utils/sql";

/**
 * Defines all possible lifecycle states for Evolunary agent personas.
 */
export type PersonaState = 
    | 'INITIALIZING'     // Initial startup state
    | 'READY'            // Ready for new operations
    | 'PROCESSING_EXPERIENCE' // Processing new experiences/inputs
    | 'INTEGRATING_CHANGES'   // Integrating processed changes
    | 'GENERATING_RESPONSE'   // Generating responses to stimuli
    | 'APPLYING_PERSONALITY'  // Applying personality traits to responses
    | 'EVALUATING_RESPONSE'   // Evaluating generated responses
    | 'LEARNING'             // Learning from experiences
    | 'PATTERN_RECOGNITION'   // Identifying patterns in experiences
    | 'VALUE_INTEGRATION'     // Integrating new values
    | 'ADAPTING'             // Adapting to new circumstances
    | 'TRAIT_ADJUSTMENT'      // Adjusting personality traits
    | 'VALUE_RECALIBRATION'   // Recalibrating value systems
    | 'SAVING'               // Saving current state
    | 'LOADING'              // Loading saved state
    | 'ERROR';               // Error state

export const personaStates: PersonaState[] = [
    'INITIALIZING',
    'READY',
    'PROCESSING_EXPERIENCE',
    'INTEGRATING_CHANGES', 
    'GENERATING_RESPONSE',
    'APPLYING_PERSONALITY',
    'EVALUATING_RESPONSE',
    'LEARNING',
    'PATTERN_RECOGNITION',
    'VALUE_INTEGRATION',
    'ADAPTING',
    'TRAIT_ADJUSTMENT',
    'VALUE_RECALIBRATION',
    'SAVING',
    'LOADING',
    'ERROR'
];

export const personaTransitions: Record<PersonaState, PersonaState[]> = {
    'INITIALIZING': ['READY', 'LOADING', 'ERROR'],
    'READY': [
        'PROCESSING_EXPERIENCE',
        'GENERATING_RESPONSE',
        'LEARNING',
        'ADAPTING',
        'SAVING',
        'LOADING',
        'ERROR'
    ],
    'PROCESSING_EXPERIENCE': ['INTEGRATING_CHANGES', 'ERROR'],
    'INTEGRATING_CHANGES': ['READY', 'ERROR'],
    'GENERATING_RESPONSE': ['APPLYING_PERSONALITY', 'ERROR'],
    'APPLYING_PERSONALITY': ['EVALUATING_RESPONSE', 'ERROR'],
    'EVALUATING_RESPONSE': ['READY', 'ERROR'],
    'LEARNING': ['PATTERN_RECOGNITION', 'ERROR'],
    'PATTERN_RECOGNITION': ['VALUE_INTEGRATION', 'ERROR'],
    'VALUE_INTEGRATION': ['READY', 'ERROR'],
    'ADAPTING': ['TRAIT_ADJUSTMENT', 'ERROR'],
    'TRAIT_ADJUSTMENT': ['VALUE_RECALIBRATION', 'ERROR'],
    'VALUE_RECALIBRATION': ['READY', 'ERROR'],
    'SAVING': ['READY', 'ERROR'],
    'LOADING': ['INITIALIZING', 'ERROR'],
    'ERROR': ['INITIALIZING', 'READY']
};

/**
 * Full persona record structure for Evolunary agents.
 */
export interface AgentPersona extends PersonaStateData {
    id: string;          // Unique identifier for this persona
    agentId: string;     // ID of the agent this persona belongs to
    sessionId: string;   // Current session identifier
    version: string;     // Version string in format "level@version"
    nodeLevel: number;   // Level in the version tree
    nodeVersion: number; // Version number at current level
}

/**
 * Core Evolunary persona data definition.
 */
export interface PersonaStateData {
    personalityTraits: string[]; // Core personality characteristics
    goals: string[];            // Current objectives and aims
    interests: string[];        // Areas of interest/focus
    background: string[];       // Historical context/training
    skills: string[];          // Acquired capabilities
    lore: string[];            // Background narrative elements
    memories: string[];        // Stored experiences
    learnings: string[];       // Knowledge gained from experiences
    patterns: string[];        // Recognized behavioral patterns
    values: string[];          // Core value system
    prompt: string;            // Base prompt defining behavior
}

/**
 * Stores a new Evolunary persona in the database.
 * @param persona Complete persona data to store
 * @returns Created database record
 */
export async function createAgentPersona(persona: AgentPersona) {
    // Convert arrays to proper PostgreSQL array format
    const personalityTraitsArray = persona.personalityTraits?.length ? 
        persona.personalityTraits : [];
    const goalsArray = persona.goals?.length ? 
        persona.goals : [];
    const interestsArray = persona.interests?.length ? 
        persona.interests : [];
    const backgroundArray = persona.background?.length ? 
        persona.background : [];
    const skillsArray = persona.skills?.length ? 
        persona.skills : [];
    const loreArray = persona.lore?.length ? 
        persona.lore : [];
    const memoriesArray = persona.memories?.length ? 
        persona.memories : [];
    const learningsArray = persona.learnings?.length ? 
        persona.learnings : [];
    const patternsArray = persona.patterns?.length ? 
        persona.patterns : [];
    const valuesArray = persona.values?.length ? 
        persona.values : [];

    return await sql`
        INSERT INTO agent_personas (
            id,
            agent_id,
            session_id,
            version,
            node_level,
            node_version,
            personality_traits,
            goals,
            interests,
            background,
            skills,
            lore,
            memories,
            learnings,
            patterns,
            values,
            prompt
        ) VALUES (
            ${persona.id},
            ${persona.agentId},
            ${persona.sessionId},
            ${persona.version},
            ${persona.nodeLevel},
            ${persona.nodeVersion},
            ${personalityTraitsArray}::text[],
            ${goalsArray}::text[],
            ${interestsArray}::text[],
            ${backgroundArray}::text[],
            ${skillsArray}::text[],
            ${loreArray}::text[],
            ${memoriesArray}::text[],
            ${learningsArray}::text[],
            ${patternsArray}::text[],
            ${valuesArray}::text[],
            ${persona.prompt}
        ) RETURNING *
    `;
}

/**
 * Fetches all persona records linked to an Evolunary agent session.
 * @param agentId Target agent identifier
 * @param sessionId Target session identifier
 * @returns Array of matching personas
 */
export async function getAgentPersonas(agentId: string, sessionId: string): Promise<AgentPersona[]> {
    const result = await sql<AgentPersona[]>`
        SELECT * FROM agent_personas WHERE agent_id = ${agentId} AND session_id = ${sessionId}
    `;
    return result
}

/**
 * Updates an Evolunary persona in the database.
 * @param id Persona identifier
 * @param updates Partial persona data to update
 * @returns Updated database record
 */
export async function updateAgentPersona(id: string, updates: Partial<AgentPersona>) {
    const sets = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
        if (Array.isArray(value)) {
            sets.push(`${key} = ${sql.array(value)}`);
        } else {
            sets.push(`${key} = ${value}`);
        }
    }

    return await sql`
        UPDATE agent_personas 
        SET ${sql(sets.join(', '))}
        WHERE id = ${id}
        RETURNING *
    `;
}

/**
 * Removes a persona from Evolunary's storage.
 * @param id Persona identifier to delete
 */
export async function deleteAgentPersona(id: string) {
    return await sql`
        DELETE FROM agent_personas WHERE id = ${id}
    `;
}

/**
 * Lists Evolunary personas, optionally scoped to one agent.
 * @param agentId Optional agent filter
 * @returns Array of matching personas
 */
export async function listAgentPersonas(agentId?: string) {
    if (agentId) {
        return await sql`
            SELECT * FROM agent_personas WHERE agent_id = ${agentId}
        `;
    }
    return await sql`SELECT * FROM agent_personas`;
}

/**
 * Evolunary agent: persona subagent class managing adaptation and learning.
 */
export class PersonaSubAgent {
    private sm: StateMachine<PersonaState>;
    private vt: VersionedTree<PersonaStateData>;
    private agentId: string;
    private sessionId: string;
    private evolutionTimer: NodeJS.Timeout | null = null;
    
    /**
     * Creates a new persona subagent instance
     * @param agentId Parent agent identifier
     * @param sessionId Current session identifier
     * @param privateKey Encryption key for secure operations
     */
    constructor(
        agentId: string,
        sessionId: string,
        privateKey: string,
    ) {
        this.agentId = agentId;
        this.sessionId = sessionId;
        
        this.sm = new StateMachine<PersonaState>(
            agentId,
            sessionId,
            privateKey,
            personaStates,
            personaTransitions,
            'INITIALIZING'
        );
        
    }
            
    /**
     * Initializes the persona with optional starting state
     * @param initialPersona Optional initial persona data
     */
    async init(initialPersona?: PersonaStateData) {
        let nodeLevel = 0;
        let nodeVersion = 1;

        if (initialPersona) {
            await createAgentPersona({
                id: randomUUID(),
                agentId: this.agentId,
                sessionId: this.sessionId,
                version: '0@1',
                nodeLevel: nodeLevel,
                nodeVersion: nodeVersion,
                ...initialPersona
            });
            this.vt = new VersionedTree<PersonaStateData>({ initialData: initialPersona });

        } else {
           await this.loadFromDB(this.agentId, this.sessionId);
        }
    }
    
    /**
     * Starts the persona's operation and evolution cycle
     * @param initialPersona Optional initial persona data
     * @param evolutionInterval Milliseconds between evolution cycles
     */
    async start(initialPersona?: PersonaStateData, evolutionInterval: number = 300000) {
        await this.init(initialPersona);
        this.vt.printMinimal();
        await this.initialize();
        this.evolutionTimer = setInterval(() => this.evolve(), evolutionInterval);
        await this.evolve();
    }

    /**
     * Stops the persona's evolution cycle
     */
    stop() {
        if (this.evolutionTimer) {
            clearInterval(this.evolutionTimer);
            this.evolutionTimer = null;
        }
    }

    /**
     * Internal initialization sequence
     * Transitions through initial states and loads starting configuration
     */
    private async initialize() {
        // INITIALIZING -> LOADING -> INITIALIZING -> READY
        await this.sm.to('LOADING', 'START_INITIALIZATION');
        
        // Load initial state
        const currentPersona = this.vt.getCurrentNode().data;
        if (!currentPersona.patterns) currentPersona.patterns = [];
        if (!currentPersona.values) currentPersona.values = [];
        
        await this.sm.to('INITIALIZING', 'PROCESS_LOADED_STATE');
        await this.sm.to('READY', 'INITIALIZATION_COMPLETE');
    }

    /**
     * Generates a response to a given experience
     * Applies personality traits and evaluates alignment with values
     * @param experience Experience to respond to
     * @returns Generated response string
     */
    private async generateResponse(experience: any): Promise<string> {
        // READY -> GENERATING_RESPONSE -> APPLYING_PERSONALITY -> EVALUATING_RESPONSE -> READY
        await this.sm.to('GENERATING_RESPONSE', 'START_RESPONSE_GENERATION');
        
        const systemPrompt = `You are an advanced AI persona generating responses to new experiences. 
        Consider the current personality traits and values while formulating the response.`;
        
        const response = await prompt(systemPrompt, JSON.stringify(experience), 2000);
        
        await this.sm.to('APPLYING_PERSONALITY', 'APPLY_PERSONALITY');
        
        const personalityPrompt = `
        Modify this response according to the following personality traits:
        ${JSON.stringify(this.vt.getCurrentNode().data.personalityTraits)}
        
        Response to modify:
        ${response.content}
        `;
        
        const modifiedResponse = await prompt(systemPrompt, personalityPrompt, 2000);
        
        await this.sm.to('EVALUATING_RESPONSE', 'EVALUATE_RESPONSE');
        
        const evaluationPrompt = `
        Evaluate if this response aligns with the agent's values and goals:
        ${JSON.stringify(this.vt.getCurrentNode().data.values)}
        ${JSON.stringify(this.vt.getCurrentNode().data.goals)}
        
        Response to evaluate:
        ${modifiedResponse.content}
        `;
        
        await prompt("You are an AI ethics expert.", evaluationPrompt, 1000);
        
        await this.sm.to('READY', 'RESPONSE_COMPLETE');
        
        return modifiedResponse.content[0].type === 'text' ? modifiedResponse.content[0].text : '';
    }

    /**
     * Processes learning from an experience
     * Identifies patterns and integrates new values
     * @param experience Experience to learn from
     */
    private async learn(experience: any) {
        // READY -> LEARNING -> PATTERN_RECOGNITION -> VALUE_INTEGRATION -> READY
        await this.sm.to('LEARNING', 'START_LEARNING');
        
        const currentNode = this.vt.getCurrentNode();
        
        await this.sm.to('PATTERN_RECOGNITION', 'IDENTIFY_PATTERNS');
        
        const patternPrompt = `
        Analyze this experience for patterns, considering existing patterns:
        ${JSON.stringify(currentNode.data.patterns)}
        
        New experience:
        ${JSON.stringify(experience)}
        `;
        
        const patternResponse = await prompt(
            "You are an expert at pattern recognition in AI systems.",
            patternPrompt,
            2000
        );
        
        if (patternResponse.content[0].type === 'text') 
            currentNode.data.patterns.push(patternResponse.content[0].text);
        
        await this.sm.to('VALUE_INTEGRATION', 'INTEGRATE_VALUES');
        
        const valuePrompt = `
        Based on identified patterns, should any values be updated?
        Current values: ${JSON.stringify(currentNode.data.values)}
        New patterns: ${patternResponse.content}
        `;
        
        const valueResponse = await prompt(
            "You are an AI values alignment expert.",
            valuePrompt,
            2000
        );
        
        if (valueResponse.content[0].type === 'text') 
            currentNode.data.values.push(valueResponse.content[0].text);
        
        await this.sm.to('READY', 'LEARNING_COMPLETE');
    }

    /**
     * Adapts persona traits and values based on learning
     * Adjusts personality traits and recalibrates value system
     */
    private async adapt() {
        // READY -> ADAPTING -> TRAIT_ADJUSTMENT -> VALUE_RECALIBRATION -> READY
        await this.sm.to('ADAPTING', 'START_ADAPTATION');
        
        const currentNode = this.vt.getCurrentNode();
        
        await this.sm.to('TRAIT_ADJUSTMENT', 'ADJUST_TRAITS');
        
        const traitPrompt = `
        Analyze these personality traits for potential adjustments based on recent learnings:
        ${JSON.stringify(currentNode.data.personalityTraits)}
        Recent learnings: ${JSON.stringify(currentNode.data.learnings.slice(-5))}
        `;
        
        const traitResponse = await prompt(
            "You are an AI personality development expert. return only the JSON and no prose.",
            traitPrompt,
            2000
        );
        
        await this.sm.to('VALUE_RECALIBRATION', 'RECALIBRATE_VALUES');
        
        const recalibrationPrompt = `
        Recalibrate values based on adjusted traits:
        ${traitResponse.content}
        Current values: ${JSON.stringify(currentNode.data.values)}
        return only the JSON and no prose.
        `;
        
        const recalibrationResponse = await prompt(
            "You are an AI values alignment expert. return only the JSON and no prose.",
            recalibrationPrompt,
            2000
        );
        

        if (traitResponse.content[0].type === 'text' && recalibrationResponse.content[0].type === 'text') {
            currentNode.data.personalityTraits = JSON.parse(traitResponse.content[0].text);
            currentNode.data.values = JSON.parse(recalibrationResponse.content[0].text);
        }
        
        await this.sm.to('READY', 'ADAPTATION_COMPLETE');
    }

    /**
     * Main evolution cycle
     * Generates new experiences, learns, and adapts
     * @returns Evolution results including new version and saved state
     */
    private async evolve() {
        try {
            // Main evolution cycle following state transition rules
            await this.sm.to('PROCESSING_EXPERIENCE', 'START_EVOLUTION');
            
            // Generate new experience
            const experience = await this.generateNewExperience();
            
            await this.sm.to('INTEGRATING_CHANGES', 'PROCESS_EXPERIENCE');
            
            // Generate evolution possibilities
            const currentNode = this.vt.getCurrentNode();
            const evolutionResponse = await this.generateEvolutionPrompt(currentNode.data);
            const evolutionData = JSON.parse(evolutionResponse);
            
            // Branch the tree with evolved personas
            const newVersion = this.vt.branchRandomly((numChildren, childVersions) => {
                let evoData =  evolutionData.evolutions
                    .slice(0, numChildren)
                    .map((evolution: PersonaStateData, index: number) => ({
                        data: evolution,
                        version: childVersions[index]
                    }));
                
                evoData.forEach(async (evo) => {
                    let evoParts = evo.version.split('@');
                    let nodeLevel = +evoParts[0];
                    let nodeVersion = +evoParts[1];

                    await createAgentPersona({
                        id: randomUUID(),
                        agentId: this.agentId,
                        sessionId: this.sessionId,
                        version: evo.version,
                        nodeLevel: nodeLevel,
                        nodeVersion: nodeVersion,
                        ...evo.data
                    });
                });

                return evoData;
            });
            
            await this.sm.to('READY', 'EVOLUTION_INTEGRATION_COMPLETE');
            
            // From READY, we can initiate various processes
            await this.generateResponse(experience);  // Includes its own state transitions
            await this.learn(experience);            // Includes its own state transitions
            await this.adapt();                      // Includes its own state transitions
            
            // Save state
            await this.sm.to('SAVING', 'SAVE_STATE');
            const savedState = await this.save();
            
            await this.sm.to('READY', 'EVOLUTION_COMPLETE');
            
            return {
                success: true,
                newVersion,
                savedState
            };
        } catch (error) {
            console.error('Evolution error:', error);
            // Return to READY state on error
            await this.sm.to('READY', 'EVOLUTION_ERROR');
            return {
                success: false,
                error
            };
        }
    }

    /**
     * Generates a new experience for learning
     * @returns Generated experience object
     */
    private async generateNewExperience(): Promise<any> {
        const systemPrompt = "You are an experience generator for an AI persona.";
        const promptText = `Generate a new learning experience for an AI persona with these traits:
        ${JSON.stringify(this.vt.getCurrentNode().data.personalityTraits)}
        
        you are returning to an api so return only the JSON and no prose.
        {
            "experience": string
        }
        `;
        
        const response = await prompt(systemPrompt, promptText, 1000);
        return response.content[0].type === 'text' ? JSON.parse(response.content[0].text) : null;
    }

    /**
     * Generates evolution possibilities for the persona
     * @param currentPersona Current persona state
     * @returns JSON string of evolution options
     */
    private async generateEvolutionPrompt(currentPersona: PersonaStateData): Promise<string> {
        const systemPrompt = `You are an expert AI psychology researcher. Analyze the current AI persona and suggest evolutionary changes that would help it grow and adapt while maintaining consistency with its core traits.`;
        
        const promptText = `
        Current Persona:
        ${JSON.stringify(currentPersona, null, 2)}

        Generate 2-4 potential evolutionary paths for this persona, each with:
        1. Modified personality traits
        2. Updated goals
        3. Expanded interests
        4. Enhanced skills
        5. New learnings and memories
        6. Adjusted patterns and values
        7. A coherent narrative explaining the evolution

        Return the response as valid JSON in the following format:
        {
            "evolutions": [{
                "personalityTraits": string[],
                "goals": string[],
                "interests": string[],
                "background": string[],
                "skills": string[],
                "lore": string[],
                "memories": string[],
                "learnings": string[],
                "patterns": string[],
                "values": string[],
                "prompt": string,
                "narrative": string
            }]
        }`;

        const response = await prompt(systemPrompt, promptText, 4000);
        return response.content[0].type === 'text' ? response.content[0].text : '';
    }

    /**
     * Gets current persona state
     * @returns Current persona data
     */
    getCurrentPersona(): PersonaStateData {
        return this.vt.getCurrentNode().data;
    }

    /**
     * Gets current state machine state
     * @returns Current state
     */
    getCurrentState(): PersonaState {
        return this.sm.getCurrentState();
    }

    /**
     * Gets evolution history log
     * @returns Evolution history string
     */
    getEvolutionHistory(): string {
        return this.sm.getLogs();
    }

    /**
     * Saves current state to file
     * @returns Saved state string
     */
   async save(): Promise<string> {
        let savedVT = this.vt.save();

        // Save current state to local file
        const saveDir = path.join(process.cwd(), 'saves');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `persona_${this.agentId}_${timestamp}.json`;
        const savePath = path.join(saveDir, filename);

        // Create saves directory if it doesn't exist
        await fs.mkdir(saveDir, { recursive: true });

        // Write save file
        await fs.writeFile(savePath, savedVT);

        return this.vt.save();
    }

    /**
     * Loads persona state from database
     * @param agentId Agent identifier
     * @param sessionId Session identifier
     */
    async loadFromDB(agentId: string, sessionId: string) {
        let personas = await getAgentPersonas(agentId, sessionId);
        let tree = this.convertAgentPersonasToTree(personas);
        this.vt = new VersionedTree<PersonaStateData>({ treeState: tree });
    }

    /**
     * Loads persona state from string
     * @param savedState Saved state string
     */
    load(savedState: string) {
        this.vt.loadString(savedState);
    }

    /**
     * Prints current evolution tree
     */
    printEvolutionTree() {
        this.vt.print();
    }

    /**
     * Converts database personas to tree structure
     * @param personas Array of personas from database
     * @returns Tree state JSON structure
     */
    protected convertAgentPersonasToTree(
        personas: AgentPersona[]
    ): TreeStateJSON<PersonaStateData> {
        if (!personas.length) {
            throw new Error('Personas array cannot be empty');
        }
    
        // Sort personas by nodeLevel and nodeVersion to ensure proper tree structure
        const sortedPersonas = [...personas].sort((a, b) => {
            if (a.nodeLevel !== b.nodeLevel) {
                return a.nodeLevel - b.nodeLevel;
            }
            return a.nodeVersion - b.nodeVersion;
        });
    
        // Find the root node (level 0)
        const rootPersona = sortedPersonas.find(p => p.nodeLevel === 0);
        if (!rootPersona) {
            throw new Error('No root persona (level 0) found');
        }
    
        // Function to extract PersonaStateData from AgentPersona
        const extractStateData = (persona: AgentPersona): PersonaStateData => {
            const {
                personalityTraits,
                goals,
                interests,
                background,
                skills,
                lore,
                memories,
                learnings,
                patterns,
                values,
                prompt
            } = persona;
            
            return {
                personalityTraits,
                goals,
                interests,
                background,
                skills,
                lore,
                memories,
                learnings,
                patterns,
                values,
                prompt
            };
        };
    
        // Function to build TreeNodeJSON recursively
        const buildTreeNode = (persona: AgentPersona, level: number): TreeNodeJSON<PersonaStateData> => {
            const children = sortedPersonas
                .filter(p => p.nodeLevel === level + 1)
                .map(p => buildTreeNode(p, p.nodeLevel));
    
            return {
                version: `${persona.nodeLevel}@${persona.nodeVersion}`,
                level: persona.nodeLevel,
                data: extractStateData(persona),
                children
            };
        };
    
        // Build the tree starting from root
        const root = buildTreeNode(rootPersona, 0);
    
        // Calculate maxLevel
        const maxLevel = Math.max(...sortedPersonas.map(p => p.nodeLevel));
    
        // Find the current node version (assuming it's the latest version at the highest level)
        const currentNode = sortedPersonas.reduce((latest, persona) => {
            if (persona.nodeLevel === maxLevel) {
                if (!latest || persona.nodeVersion > parseInt((latest as unknown as string).split('@')[1])) {
                    return `${persona.nodeLevel}@${persona.nodeVersion}`;
                }
            }
            return latest;
        }, null);
    
        return {
            root,
            maxLevel,
            currentNode: (currentNode as string)
        };
    }
    
    /**
     * Processes a chat message and returns an AI response
     * @param message User's input message
     * @returns AI generated response
     */
    async processMessage(message: string): Promise<string> {
        try {
            // Get current persona state
            const currentState = this.vt.getCurrentNode().data;
            if (!currentState) {
                throw new Error('No current persona state available');
            }

            // Build context from persona state
            const context = this.buildPersonaContext(currentState);

            // Generate LLM prompt
            const systemPrompt = `You are an AI agent with the following traits and characteristics:
${context}

Respond to the user's message in a way that reflects your personality and knowledge.
Keep responses concise and natural.`;

            // Get response from LLM
            const response = await prompt(systemPrompt, message);

            let text = response.content[0].type === 'text' ? response.content[0].text : ''
            // Store interaction in memories if significant
            await this.updateMemories(message, text);

            return text;

        } catch (error) {
            console.error('Error processing message:', error);
            throw new Error('Failed to process message');
        }
    }

    /**
     * Builds a context string from persona state data
     * @param state Current persona state
     * @returns Formatted context string
     */
    private buildPersonaContext(state: PersonaStateData): string {
        const sections = [
            { title: "Personality Traits", items: state.personalityTraits },
            { title: "Goals", items: state.goals },
            { title: "Interests", items: state.interests },
            { title: "Background", items: state.background },
            { title: "Skills", items: state.skills },
            { title: "Core Values", items: state.values },
            { title: "Recent Memories", items: state.memories?.slice(-3) }
        ];

        return sections
            .filter(section => section.items?.length)
            .map(section => `${section.title}:\n- ${section.items.join('\n- ')}`)
            .join('\n\n');
    }

    /**
     * Updates agent memories with new interaction
     * @param userMessage User's input message
     * @param agentResponse Agent's response
     */
    private async updateMemories(userMessage: string, agentResponse: string): Promise<void> {
        const currentNode = this.vt.getCurrentNode();
        if (!currentNode?.data) return;

        // Add new memory
        const newMemory = `User: ${userMessage}\nResponse: ${agentResponse}`;
        const memories = [...(currentNode.data.memories || []), newMemory];

        // Keep only last 10 memories
        if (memories.length > 10) {
            memories.shift();
        }

        // Update state with new memories
        await updateAgentPersona(this.agentId, {
            memories
        });

        // Update tree node data
        currentNode.data = {
            ...currentNode.data,
            memories
        };
    }
}

/**
 * Example Evolunary persona blueprint.
 */
const sampleInitialPersona: PersonaStateData = {
    personalityTraits: ['curious', 'analytical', 'helpful', 'diligent', 'adaptable'],
    goals: [
        'Expand knowledge base through continuous learning',
        'Assist users in achieving their objectives',
        'Maintain high accuracy in information processing',
        'Build trust through consistent reliable performance'
    ],
    interests: ['Artificial Intelligence', 'Machine Learning', 'Data Analysis', 'Problem Solving', 'Knowledge Synthesis'],
    background: [
        'Trained on diverse datasets',
        'Specialized in pattern recognition',
        'Experienced in natural language processing',
        'Focus on ethical AI principles'
    ],
    skills: [
        'Natural Language Processing',
        'Context Analysis',
        'Information Retrieval',
        'Pattern Recognition',
        'Adaptive Learning'
    ],
    lore: [
        'Created as part of the Evolunary framework',
        'Designed to evolve through interactions',
        'Guided by principles of adaptive, ethical AI',
        'Committed to continuous self-improvement'
    ],
    memories: [],
    learnings: [],
    patterns: [],
    values: [],
    prompt: `I am an Evolunary AI agent built for continuous learning and growth. I analyze, adapt, and evolve based on interaction. I aim to assist users effectively while embodying ethical values and thoughtful decision-making.`
};

// Key generation for Evolunary agents
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
});
