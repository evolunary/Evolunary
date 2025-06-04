/**
 * Evolunary Module: Autonomous Token Deployment Agent
 * 
 * This module defines the PumpFunSubAgent — a persona-driven agent capable of independently
 * launching tokens using the Pump.fun platform. It handles full lifecycle management:
 * metadata generation, artwork creation, on-chain token creation, performance monitoring,
 * and strategy refinement.
 * 
 * Each launch is tracked through a state machine and versioned tree for full reproducibility.
 */

import { StateMachine } from "../sm";
import { TreeNodeJSON, TreeStateJSON, VersionedTree } from "../tree";
import { prompt } from "../../utils/llm";
import { generateKeyPairSync, randomUUID } from "crypto";
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sql from "../../utils/sql";

// STATE DEFINITIONS

export type PumpFunState = 
    | 'INITIALIZING'
    | 'READY'
    | 'GENERATING_METADATA'
    | 'CREATING_ARTWORK'
    | 'UPLOADING_ASSETS'
    | 'PREPARING_LAUNCH'
    | 'CREATING_TOKEN'
    | 'CONFIGURING_POOL'
    | 'MONITORING_LAUNCH'
    | 'ANALYZING_PERFORMANCE'
    | 'ADJUSTING_STRATEGY'
    | 'SAVING'
    | 'LOADING'
    | 'ERROR';

export const pumpFunStates: PumpFunState[] = [ ... ]; // unchanged
export const pumpFunTransitions: Record<PumpFunState, PumpFunState[]> = { ... }; // unchanged

// INTERFACES

export interface TokenLaunchConfig {
    name: string;
    symbol: string;
    description: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    initialSupply: number;
    initialPrice: number;
    launchDate: Date;
}

export interface PumpFunStateData {
    tokenConfig: TokenLaunchConfig;
    artworkPath?: string;
    metadataUri?: string;
    mintAddress?: string;
    poolAddress?: string;
    launchStatus: {
        launched: boolean;
        timestamp?: number;
        signature?: string;
    };
    performance: {
        price: number;
        volume: number;
        holders: number;
    };
    strategy: {
        marketingPlan: string[];
        liquidityStrategy: string;
        tradingStrategy: string;
    };
}

// CORE AGENT CLASS

export class PumpFunSubAgent {
    private sm: StateMachine<PumpFunState>;
    private vt: VersionedTree<PumpFunStateData>;
    private connection: Connection;
    private agentId: string;
    private sessionId: string;
    private monitoringTimer: NodeJS.Timeout | null = null;

    constructor(
        agentId: string,
        sessionId: string,
        privateKey: string,
        rpcEndpoint: string
    ) {
        this.agentId = agentId;
        this.sessionId = sessionId;
        
        this.sm = new StateMachine<PumpFunState>(
            agentId,
            sessionId,
            privateKey,
            pumpFunStates,
            pumpFunTransitions,
            'INITIALIZING'
        );

        this.connection = new Connection(rpcEndpoint, 'confirmed');
    }

    /**
     * Initializes the agent with base token config and sets READY state
     */
    async init(initialConfig?: TokenLaunchConfig) {
        const initialState: PumpFunStateData = {
            tokenConfig: initialConfig || {
                name: "",
                symbol: "",
                description: "",
                initialSupply: 1000000,
                initialPrice: 0.0001,
                launchDate: new Date()
            },
            launchStatus: { launched: false },
            performance: { price: 0, volume: 0, holders: 0 },
            strategy: {
                marketingPlan: [],
                liquidityStrategy: "Initial liquidity: 1 SOL",
                tradingStrategy: "Gradual price discovery"
            }
        };

        this.vt = new VersionedTree<PumpFunStateData>({ initialData: initialState });
        await this.sm.to('READY', 'INITIALIZATION_COMPLETE');
    }

    /**
     * Starts a full token launch sequence:
     * 1. Generates metadata
     * 2. Creates artwork
     * 3. Uploads to IPFS
     * 4. Mints token on Pump.fun
     * 5. Begins real-time monitoring
     */
    async startLaunch() {
        try {
            await this.sm.to('GENERATING_METADATA', 'START_LAUNCH');
            const currentState = this.vt.getCurrentNode().data;

            const metadata = await this.generateTokenMetadata(currentState.tokenConfig);

            await this.sm.to('CREATING_ARTWORK', 'METADATA_GENERATED');
            const artworkPath = await this.generateTokenArtwork(metadata);
            currentState.artworkPath = artworkPath;

            await this.sm.to('UPLOADING_ASSETS', 'ARTWORK_CREATED');
            const metadataUri = await this.uploadToIPFS(artworkPath, metadata);
            currentState.metadataUri = metadataUri;

            await this.sm.to('PREPARING_LAUNCH', 'ASSETS_UPLOADED');
            const mintKeypair = Keypair.generate();
            const signature = await this.createToken(mintKeypair, metadataUri);

            currentState.mintAddress = mintKeypair.publicKey.toBase58();
            currentState.launchStatus = { launched: true, timestamp: Date.now(), signature };

            await this.sm.to('MONITORING_LAUNCH', 'TOKEN_CREATED');
            this.startMonitoring();

            return { success: true, mintAddress: currentState.mintAddress, signature };

        } catch (error) {
            console.error('Launch error:', error);
            await this.sm.to('ERROR', 'LAUNCH_FAILED');
            throw error;
        }
    }

    // --- Utility Methods ---

    private async generateTokenMetadata(config: TokenLaunchConfig) {
        const p = `Generate engaging token metadata for a new token with these parameters:\n
        Name: ${config.name}\nSymbol: ${config.symbol}\nDescription: ${config.description}`;

        const response = await prompt("You are a crypto marketing expert.", p, 2000);
        return response.content[0].type === 'text' ? JSON.parse(response.content[0].text) : null;
    }

    private async generateTokenArtwork(metadata: any): Promise<string> {
        // Placeholder for actual artwork generator
        const artworkPath = path.join(process.cwd(), 'assets', `${metadata.symbol.toLowerCase()}.png`);
        return artworkPath;
    }

    private async uploadToIPFS(artworkPath: string, metadata: any): Promise<string> {
        const formData = new FormData();
        formData.append("file", (await fs.readFile(artworkPath)).toString('base64'));
        formData.append("name", metadata.name);
        formData.append("symbol", metadata.symbol);
        formData.append("description", metadata.description);

        if (metadata.twitter) formData.append("twitter", metadata.twitter);
        if (metadata.telegram) formData.append("telegram", metadata.telegram);
        if (metadata.website) formData.append("website", metadata.website);

        const response = await fetch("https://pump.fun/api/ipfs", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        return data.metadataUri;
    }

    private async createToken(mintKeypair: Keypair, metadataUri: string): Promise<string> {
        const currentState = this.vt.getCurrentNode().data;

        const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                publicKey: this.agentId,
                action: "create",
                tokenMetadata: {
                    name: currentState.tokenConfig.name,
                    symbol: currentState.tokenConfig.symbol,
                    uri: metadataUri
                },
                mint: mintKeypair.publicKey.toBase58(),
                denominatedInSol: "true",
                amount: 1,
                slippage: 10,
                priorityFee: 0.0005,
                pool: "pump"
            })
        });

        if (response.status === 200) {
            const tx = VersionedTransaction.deserialize(new Uint8Array(await response.arrayBuffer()));
            const signature = await this.connection.sendTransaction(tx);
            return signature;
        } else {
            throw new Error(`Failed to create token: ${response.statusText}`);
        }
    }

    private startMonitoring() {
        if (this.monitoringTimer) clearInterval(this.monitoringTimer);

        this.monitoringTimer = setInterval(async () => {
            await this.updatePerformanceMetrics();
        }, 60000);
    }

    private async updatePerformanceMetrics() {
        const currentState = this.vt.getCurrentNode().data;
        if (!currentState.mintAddress) return;

        try {
            currentState.performance = {
                price: 0,
                volume: 0,
                holders: 0
            };

            await this.sm.to('ANALYZING_PERFORMANCE', 'UPDATE_METRICS');
            await this.analyzePerformance();
        } catch (err) {
            console.error('Error updating metrics:', err);
        }
    }

    private async analyzePerformance() {
        const currentState = this.vt.getCurrentNode().data;

        const promptText = `Analyze token performance:\nPrice: ${currentState.performance.price}\nVolume: ${currentState.performance.volume}\nHolders: ${currentState.performance.holders}\nStrategy: ${JSON.stringify(currentState.strategy)}\n\nSuggest adjustments in JSON.`;

        const response = await prompt("You are a crypto trading strategy expert.", promptText, 2000);
        const newStrategy = response.content[0].type === 'text' ? JSON.parse(response.content[0].text) : {};

        await this.sm.to('ADJUSTING_STRATEGY', 'ANALYSIS_COMPLETE');
        currentState.strategy = newStrategy;

        await this.sm.to('READY', 'STRATEGY_ADJUSTED');
    }

    stop() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
    }
}
