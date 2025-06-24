/**
 * This module implements a Twitter interaction management system for AI agents.
 * It handles posting, engagement monitoring, and strategy optimization.
 */

import { StateMachine } from "../sm";
import { TreeNodeJSON, TreeStateJSON, VersionedTree } from "../tree";
import { prompt } from "../../utils/llm";
import { randomUUID } from "crypto";
import * as fs from 'node:fs/promises';
import sql from "../../utils/sql";
import chalk from "chalk";

/**
 * Defines all possible states for the Twitter interaction process
 */
export type TwitterState = 
    | 'INITIALIZING'           // Initial setup state
    | 'READY'                  // Ready for operations
    | 'ANALYZING_TRENDS'       // Analyzing Twitter trends
    | 'GENERATING_CONTENT'     // Creating tweet content
    | 'SCHEDULING_POSTS'       // Scheduling tweets
    | 'POSTING'               // Posting tweets
    | 'MONITORING_ENGAGEMENT'  // Monitoring post engagement
    | 'RESPONDING'            // Responding to interactions
    | 'ANALYZING_PERFORMANCE' // Analyzing tweet performance
    | 'ADJUSTING_STRATEGY'    // Adjusting posting strategy
    | 'SAVING'               // Saving state
    | 'LOADING'              // Loading state
    | 'ERROR';               // Error state

/**
 * Array of all possible Twitter states
 */
export const twitterStates: TwitterState[] = [
    'INITIALIZING',
    'READY',
    'ANALYZING_TRENDS',
    'GENERATING_CONTENT',
    'SCHEDULING_POSTS',
    'POSTING',
    'MONITORING_ENGAGEMENT',
    'RESPONDING',
    'ANALYZING_PERFORMANCE',
    'ADJUSTING_STRATEGY',
    'SAVING',
    'LOADING',
    'ERROR'
];

/**
 * Defines valid state transitions for the Twitter state machine
 */
export const twitterTransitions: Record<TwitterState, TwitterState[]> = {
    'INITIALIZING': ['READY', 'LOADING', 'ERROR'],
    'READY': [
        'ANALYZING_TRENDS',
        'GENERATING_CONTENT',
        'MONITORING_ENGAGEMENT',
        'SAVING',
        'ERROR'
    ],
    'ANALYZING_TRENDS': ['GENERATING_CONTENT', 'ERROR'],
    'GENERATING_CONTENT': ['SCHEDULING_POSTS', 'ERROR'],
    'SCHEDULING_POSTS': ['POSTING', 'ERROR'],
    'POSTING': ['MONITORING_ENGAGEMENT', 'ERROR'],
    'MONITORING_ENGAGEMENT': ['RESPONDING', 'ANALYZING_PERFORMANCE', 'ERROR'],
    'RESPONDING': ['MONITORING_ENGAGEMENT', 'ERROR'],
    'ANALYZING_PERFORMANCE': ['ADJUSTING_STRATEGY', 'READY', 'ERROR'],
    'ADJUSTING_STRATEGY': ['READY', 'ERROR'],
    'SAVING': ['READY', 'ERROR'],
    'LOADING': ['INITIALIZING', 'ERROR'],
    'ERROR': ['INITIALIZING', 'READY']
};

/**
 * Interface for Twitter content
 */
export interface TwitterContent {
    text: string;
    media?: string[];
    scheduledTime?: Date;
    hashtags: string[];
    mentions: string[];
    threadId?: string;
}

/**
 * Interface for Twitter engagement metrics
 */
export interface TwitterEngagement {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    engagementRate: number;
}

/**
 * Interface for Twitter state data
 */
export interface TwitterStateData {
    content: TwitterContent[];
    schedule: {
        optimal_times: Date[];
        frequency: number;
        timezone: string;
    };
    engagement: {
        [tweetId: string]: TwitterEngagement;
    };
    strategy: {
        targetAudience: string[];
        contentThemes: string[];
        hashtagStrategy: string[];
        engagementApproach: string;
        postingFrequency: string;
    };
    performance: {
        avgEngagementRate: number;
        topPerformingContent: string[];
        audienceGrowth: number;
    };
}

/**
 * Core class implementing Twitter interaction management
 */
export class TwitterSubAgent {
    private sm: StateMachine<TwitterState>;
    private vt: VersionedTree<TwitterStateData>;
    private agentId: string;
    private sessionId: string;
    private monitoringTimer: NodeJS.Timeout | null = null;
    private isTesting: boolean = true;

    private testDiagnostics: {
        bootTime: string;
        stateTransitions: { from: string; to: string; reason: string; timestamp: string }[];
        postedTweets: { text: string; time: string }[];
        heartbeats: string[];
    } = {
        bootTime: new Date().toISOString(),
        stateTransitions: [],
        postedTweets: [],
        heartbeats: []
    };

    constructor(agentId: string, sessionId: string, privateKey: string) {
        this.agentId = agentId;
        this.sessionId = sessionId;

        this.sm = new StateMachine<TwitterState>(
            agentId,
            sessionId,
            privateKey,
            twitterStates,
            twitterTransitions,
            'INITIALIZING'
        );

        this.logStatus("BOOT", "Initializing Vanta AI agent");
        console.log(chalk.gray(`[agent] ${agentId}`));
        console.log(chalk.gray(`[session] ${sessionId}`));
        console.log(chalk.gray(`[env] ${new Date().toISOString()}`));
        console.log(chalk.gray(`[hash] ${randomUUID().slice(0, 12)}`));
        console.log(chalk.gray(`[mode] TESTING MODE ENABLED`));
    }

    private logStatus(stage: string, message: string) {
        console.log(chalk.blueBright(`[vanta:${stage.toLowerCase()}]`), chalk.white(message));
    }

    private reportHeartbeat() {
        const timestamp = new Date().toISOString();
        this.testDiagnostics.heartbeats.push(timestamp);
        console.log(chalk.gray(`[heartbeat] Vanta ping @ ${timestamp}`));
    }

    private async transition(to: TwitterState, reason: string) {
        const from = this.sm.getState();
        await this.sm.to(to, reason);
        if (this.isTesting) {
            this.testDiagnostics.stateTransitions.push({
                from,
                to,
                reason,
                timestamp: new Date().toISOString()
            });
        }
    }

    async init() {
        this.logStatus("INIT", "Configuring initial state tree...");

        const initialState: TwitterStateData = {
            content: [],
            schedule: {
                optimal_times: [],
                frequency: 4,
                timezone: 'UTC'
            },
            engagement: {},
            strategy: {
                targetAudience: ['crypto_enthusiasts', 'tech_savvy'],
                contentThemes: ['project_updates', 'market_insights'],
                hashtagStrategy: ['#crypto', '#blockchain'],
                engagementApproach: 'community_focused',
                postingFrequency: 'moderate'
            },
            performance: {
                avgEngagementRate: 0,
                topPerformingContent: [],
                audienceGrowth: 0
            }
        };

        this.vt = new VersionedTree<TwitterStateData>({ initialData: initialState });

        await this.transition('READY', 'INITIALIZATION_COMPLETE');

        this.logStatus("READY", "System is prepared for content ops");
        this.reportHeartbeat();
    }

    async createContent() {
        try {
            await this.transition('ANALYZING_TRENDS', 'START_CONTENT_CREATION');

            const trends = await this.analyzeTrends();
            await this.transition('GENERATING_CONTENT', 'TRENDS_ANALYZED');

            const content = await this.generateContent(trends);
            await this.transition('SCHEDULING_POSTS', 'CONTENT_GENERATED');

            const schedule = await this.scheduleContent(content);
            await this.transition('POSTING', 'CONTENT_SCHEDULED');

            const postResult = await this.postContent(content, schedule);
            await this.transition('MONITORING_ENGAGEMENT', 'CONTENT_POSTED');

            return postResult;
        } catch (error) {
            console.error(chalk.red(`[error] Content creation failed`), error);
            await this.transition('ERROR', 'CONTENT_CREATION_FAILED');
            throw error;
        }
    }

    private async analyzeTrends() {
        const currentState = this.vt.getCurrentNode().data;

        const trendsPrompt = `Analyze current Twitter trends relevant to:
        Target Audience: ${currentState.strategy.targetAudience.join(', ')}
        Content Themes: ${currentState.strategy.contentThemes.join(', ')}

        Return trending topics and hashtags as JSON.`;

        const response = await prompt("You are a social media trends analyst.", trendsPrompt, 2000);
        return response.content[0].type === 'text' ? JSON.parse(response.content[0].text) : null;
    }

    private async generateContent(trends: any): Promise<TwitterContent> {
        const currentState = this.vt.getCurrentNode().data;

        const contentPrompt = `Generate engaging tweet content based on:
        Trends: ${JSON.stringify(trends)}
        Strategy: ${JSON.stringify(currentState.strategy)}

        Return tweet content as JSON including text, hashtags, and mentions.`;

        const response = await prompt("You are a social media content creator.", contentPrompt, 2000);
        return response.content[0].type === 'text' ? JSON.parse(response.content[0].text) : null;
    }

    private async scheduleContent(content: TwitterContent) {
        const currentState = this.vt.getCurrentNode().data;

        currentState.content.push(content);
        const scheduledTime = new Date();
        scheduledTime.setHours(scheduledTime.getHours() + 1);

        return scheduledTime;
    }

    private async postContent(content: TwitterContent, scheduledTime: Date): Promise<string> {
        const postedAt = scheduledTime.toISOString();
        console.log(chalk.gray(`[post] Scheduled tweet at ${postedAt}`));
        console.log(chalk.gray(`[post] Content payload: ${content.text.slice(0, 80)}...`));

        if (this.isTesting) {
            this.testDiagnostics.postedTweets.push({
                text: content.text,
                time: postedAt
            });
        }

        return 'tweet_id_placeholder';
    }

    private startMonitoring() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }

        this.monitoringTimer = setInterval(async () => {
            await this.monitorEngagement();
        }, 300000); // 5 min
    }

    private async monitorEngagement() {
        try {
            await this.transition('MONITORING_ENGAGEMENT', 'START_MONITORING');
            await this.transition('ANALYZING_PERFORMANCE', 'ENGAGEMENT_MONITORED');
            await this.analyzePerformance();
        } catch (error) {
            console.error(chalk.red(`[error] Monitoring failed`), error);
            await this.transition('ERROR', 'MONITORING_FAILED');
        }
    }

    private async analyzePerformance() {
        const currentState = this.vt.getCurrentNode().data;

        const analysisPrompt = `Analyze Twitter performance and suggest strategy adjustments:
        Current Performance: ${JSON.stringify(currentState.performance)}
        Current Strategy: ${JSON.stringify(currentState.strategy)}

        Suggest strategy adjustments in JSON format.`;

        const response = await prompt("You are a social media strategy expert.", analysisPrompt, 2000);
        const newStrategy = response.content[0].type === 'text' ? JSON.parse(response.content[0].text) : {};

        await this.transition('ADJUSTING_STRATEGY', 'ANALYSIS_COMPLETE');
        currentState.strategy = newStrategy;
        await this.transition('READY', 'STRATEGY_ADJUSTED');
    }

    stop() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        if (this.isTesting) {
            const filename = `vanta_test_log_${this.sessionId}.json`;
            fs.writeFile(filename, JSON.stringify(this.testDiagnostics, null, 2))
                .then(() => {
                    console.log(chalk.green(`[export] Test diagnostics written to ${filename}`));
                })
                .catch((err) => {
                    console.error(chalk.red(`[error] Failed to write diagnostics`), err);
                });
        }
    }
}
