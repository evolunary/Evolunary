/**
 * This module implements an SMS messaging management system for AI agents.
 * It handles SMS campaigns, automated responses, and engagement tracking.
 */

import { StateMachine } from "../sm";
import { TreeNodeJSON, TreeStateJSON, VersionedTree } from "../tree";
import { prompt } from "../../utils/llm";
import { randomUUID } from "crypto";
import * as fs from 'node:fs/promises';
import sql from "../../utils/sql";

/**
 * Defines all possible states for the SMS messaging process
 */
export type SMSState = 
    | 'INITIALIZING'           // Initial setup state
    | 'READY'                  // Ready for operations
    | 'COMPOSING_MESSAGE'      // Creating message content
    | 'VALIDATING_NUMBERS'     // Validating phone numbers
    | 'PREPARING_CAMPAIGN'     // Preparing message campaign
    | 'SENDING_MESSAGES'       // Sending SMS messages
    | 'MONITORING_DELIVERY'    // Monitoring message delivery
    | 'PROCESSING_RESPONSES'   // Processing incoming responses
    | 'ANALYZING_PERFORMANCE'  // Analyzing campaign performance
    | 'ADJUSTING_STRATEGY'     // Adjusting messaging strategy
    | 'HANDLING_OPT_OUTS'     // Processing opt-out requests
    | 'SAVING'                // Saving state
    | 'LOADING'               // Loading state
    | 'ERROR';                // Error state

/**
 * Array of all possible SMS states
 */
export const smsStates: SMSState[] = [
    'INITIALIZING',
    'READY',
    'COMPOSING_MESSAGE',
    'VALIDATING_NUMBERS',
    'PREPARING_CAMPAIGN',
    'SENDING_MESSAGES',
    'MONITORING_DELIVERY',
    'PROCESSING_RESPONSES',
    'ANALYZING_PERFORMANCE',
    'ADJUSTING_STRATEGY',
    'HANDLING_OPT_OUTS',
    'SAVING',
    'LOADING',
    'ERROR'
];

/**
 * Defines valid state transitions for the SMS state machine
 */
export const smsTransitions: Record<SMSState, SMSState[]> = {
    'INITIALIZING': ['READY', 'LOADING', 'ERROR'],
    'READY': [
        'COMPOSING_MESSAGE',
        'VALIDATING_NUMBERS',
        'PROCESSING_RESPONSES',
        'HANDLING_OPT_OUTS',
        'SAVING',
        'ERROR'
    ],
    'COMPOSING_MESSAGE': ['VALIDATING_NUMBERS', 'ERROR'],
    'VALIDATING_NUMBERS': ['PREPARING_CAMPAIGN', 'ERROR'],
    'PREPARING_CAMPAIGN': ['SENDING_MESSAGES', 'ERROR'],
    'SENDING_MESSAGES': ['MONITORING_DELIVERY', 'ERROR'],
    'MONITORING_DELIVERY': ['PROCESSING_RESPONSES', 'ANALYZING_PERFORMANCE', 'ERROR'],
    'PROCESSING_RESPONSES': ['MONITORING_DELIVERY', 'HANDLING_OPT_OUTS', 'ERROR'],
    'ANALYZING_PERFORMANCE': ['ADJUSTING_STRATEGY', 'READY', 'ERROR'],
    'ADJUSTING_STRATEGY': ['READY', 'ERROR'],
    'HANDLING_OPT_OUTS': ['READY', 'ERROR'],
    'SAVING': ['READY', 'ERROR'],
    'LOADING': ['INITIALIZING', 'ERROR'],
    'ERROR': ['INITIALIZING', 'READY']
};

/**
 * Interface for SMS message content
 */
export interface SMSContent {
    text: string;
    template?: string;
    variables?: { [key: string]: string };
    shortCode?: string;
    replyOptions?: string[];
    scheduledTime?: Date;
    expiryTime?: Date;
}

/**
 * Interface for SMS delivery metrics
 */
export interface SMSMetrics {
    sent: number;
    delivered: number;
    failed: number;
    responses: number;
    optOuts: number;
    deliveryRate: number;
    responseRate: number;
    cost: number;
}

/**
 * Interface for SMS state data
 */
export interface SMSStateData {
    campaigns: {
        [campaignId: string]: {
            name: string;
            content: SMSContent;
            targetNumbers: string[];
            metrics: SMSMetrics;
            status: 'draft' | 'scheduled' | 'active' | 'completed' | 'failed';
        }
    };
    subscribers: {
        [phoneNumber: string]: {
            status: 'active' | 'opted_out';
            lastMessageDate?: Date;
            responseHistory: string[];
            tags: string[];
        }
    };
    templates: {
        [templateId: string]: {
            name: string;
            content: string;
            variables: string[];
            usage: number;
            performance: number;
        }
    };
    autoResponders: {
        [trigger: string]: {
            response: string;
            active: boolean;
            usageCount: number;
        }
    };
    strategy: {
        sendingRate: number;
        optimalTimes: string[];
        messageLength: 'short' | 'medium' | 'long';
        splitLongMessages: boolean;
        retryAttempts: number;
        responseTimeout: number;
    };
    compliance: {
        optOutKeywords: string[];
        disclaimerText: string;
        consentRequired: boolean;
        maxMessagesPerDay: number;
        quietHours: {
            start: string;
            end: string;
            timezone: string;
        };
    };
    performance: {
        dailyStats: {
            date: string;
            metrics: SMSMetrics;
        }[];
        costPerMessage: number;
        averageResponseRate: number;
        optOutRate: number;
    };
}

/**
 * Core class implementing SMS messaging management
 */
export class SMSSubAgent {
    private sm: StateMachine<SMSState>;
    private vt: VersionedTree<SMSStateData>;
    private agentId: string;
    private sessionId: string;
    private monitoringTimer: NodeJS.Timeout | null = null;

    constructor(
        agentId: string,
        sessionId: string,
        privateKey: string
    ) {
        this.agentId = agentId;
        this.sessionId = sessionId;
        
        this.sm = new StateMachine<SMSState>(
            agentId,
            sessionId,
            privateKey,
            smsStates,
            smsTransitions,
            'INITIALIZING'
        );
    }

    /**
     * Initializes the SMS subagent
     */
    async init() {
        const initialState: SMSStateData = {
            campaigns: {},
            subscribers: {},
            templates: {
                'welcome': {
                    name: 'Welcome Message',
                    content: 'Welcome to {project}! Reply STOP to opt out.',
                    variables: ['project'],
                    usage: 0,
                    performance: 0
                }
            },
            autoResponders: {
                'HELP': {
                    response: 'For assistance, please visit our website or reply with your question.',
                    active: true,
                    usageCount: 0
                }
            },
            strategy: {
                sendingRate: 10, // messages per second
                optimalTimes: ['10:00', '14:00', '17:00'],
                messageLength: 'medium',
                splitLongMessages: true,
                retryAttempts: 3,
                responseTimeout: 3600 // 1 hour in seconds
            },
            compliance: {
                optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'CANCEL'],
                disclaimerText: 'Msg&data rates may apply. Reply STOP to opt out.',
                consentRequired: true,
                maxMessagesPerDay: 3,
                quietHours: {
                    start: '21:00',
                    end: '09:00',
                    timezone: 'UTC'
                }
            },
            performance: {
                dailyStats: [],
                costPerMessage: 0.01,
                averageResponseRate: 0,
                optOutRate: 0
            }
        };

        this.vt = new VersionedTree<SMSStateData>({ initialData: initialState });
        await this.sm.to('READY', 'INITIALIZATION_COMPLETE');
    }

    /**
     * Creates and sends a new SMS campaign
     */
    async createCampaign(campaignData: {
        name: string;
        content: SMSContent;
        targetNumbers: string[];
    }) {
        try {
            await this.sm.to('COMPOSING_MESSAGE', 'START_CAMPAIGN');
            
            // Compose message
            const message = await this.composeMessage(campaignData.content);
            
            await this.sm.to('VALIDATING_NUMBERS', 'MESSAGE_COMPOSED');
            
            // Validate phone numbers
            const validNumbers = await this.validateNumbers(campaignData.targetNumbers);
            
            await this.sm.to('PREPARING_CAMPAIGN', 'NUMBERS_VALIDATED');
            
            // Create campaign
            const campaignId = randomUUID();
            const campaign = {
                name: campaignData.name,
                content: message,
                targetNumbers: validNumbers,
                metrics: {
                    sent: 0,
                    delivered: 0,
                    failed: 0,
                    responses: 0,
                    optOuts: 0,
                    deliveryRate: 0,
                    responseRate: 0,
                    cost: 0
                },
                status: 'scheduled' as const
            };
            
            this.vt.getCurrentNode().data.campaigns[campaignId] = campaign;
            
            await this.sm.to('SENDING_MESSAGES', 'CAMPAIGN_PREPARED');
            
            // Send messages
            await this.sendCampaign(campaignId);
            
            await this.sm.to('MONITORING_DELIVERY', 'MESSAGES_SENT');
            
            return campaignId;
            
        } catch (error) {
            console.error('Campaign creation error:', error);
            await this.sm.to('ERROR', 'CAMPAIGN_CREATION_FAILED');
            throw error;
        }
    }

    /**
     * Composes message content with compliance and optimization
     */
    private async composeMessage(content: SMSContent): Promise<SMSContent> {
        const currentState = this.vt.getCurrentNode().data;
        
        const compositionPrompt = `Compose SMS message based on:
        Content: ${JSON.stringify(content)}
        Strategy: ${JSON.stringify(currentState.strategy)}
        Compliance: ${JSON.stringify(currentState.compliance)}
        
        Return optimized message content as JSON.`;
        
        const response = await prompt("You are an SMS marketing expert.", compositionPrompt, 2000);
        return response.content[0].type === 'text' ? JSON.parse(response.content[0].text) : null;
    }

    /**
     * Validates phone numbers
     */
    private async validateNumbers(numbers: string[]): Promise<string[]> {
        // Implement phone number validation logic
        // This would typically involve checking format and DNC list
        return numbers.filter(number => {
            return /^\+?[1-9]\d{1,14}$/.test(number);
        });
    }

    /**
     * Sends campaign messages
     */
    private async sendCampaign(campaignId: string) {
        const campaign = this.vt.getCurrentNode().data.campaigns[campaignId];
        if (!campaign) return;

        // Implement actual SMS sending logic here
        // This is a placeholder that would need to be implemented with your SMS provider
        console.log(`Sending campaign ${campaignId} to ${campaign.targetNumbers.length} numbers`);
    }

    /**
     * Processes incoming SMS responses
     */
    private async processResponse(from: string, message: string) {
        try {
            await this.sm.to('PROCESSING_RESPONSES', 'NEW_RESPONSE');
            
            const currentState = this.vt.getCurrentNode().data;
            
            // Check for opt-out keywords
            if (currentState.compliance.optOutKeywords.includes(message.toUpperCase())) {
                await this.sm.to('HANDLING_OPT_OUTS', 'OPT_OUT_REQUESTED');
                await this.handleOptOut(from);
                return;
            }
            
            // Handle auto-responses
            const autoResponse = currentState.autoResponders[message.toUpperCase()];
            if (autoResponse?.active) {
                await this.sendMessage({
                    text: autoResponse.response,
                    shortCode: currentState.templates.welcome.name
                }, from);
                autoResponse.usageCount++;
            }
            
            await this.sm.to('READY', 'RESPONSE_PROCESSED');
            
        } catch (error) {
            console.error('Response processing error:', error);
            await this.sm.to('ERROR', 'RESPONSE_PROCESSING_FAILED');
        }
    }

    /**
     * Handles opt-out requests
     */
    private async handleOptOut(phoneNumber: string) {
        const currentState = this.vt.getCurrentNode().data;
        
        if (currentState.subscribers[phoneNumber]) {
            currentState.subscribers[phoneNumber].status = 'opted_out';
        }
        
        await this.sendMessage({
            text: 'You have been successfully unsubscribed. You will receive no further messages.',
            shortCode: 'OPT_OUT_CONFIRM'
        }, phoneNumber);
        
        await this.sm.to('READY', 'OPT_OUT_PROCESSED');
    }

    /**
     * Sends a single SMS message
     */
    private async sendMessage(content: SMSContent, to: string): Promise<boolean> {
        // Implement actual SMS sending logic here
        console.log(`Sending SMS to ${to}: ${content.text}`);
        return true;
    }

    /**
     * Starts monitoring message delivery and responses
     */
    private startMonitoring() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }
        
        this.monitoringTimer = setInterval(async () => {
            await this.monitorDelivery();
        }, 60000); // Monitor every minute
    }

    /**
     * Monitors message delivery status
     */
    private async monitorDelivery() {
        try {
            await this.sm.to('MONITORING_DELIVERY', 'START_MONITORING');
            
            // Implement delivery status checking logic here
            
            await this.sm.to('ANALYZING_PERFORMANCE', 'DELIVERY_MONITORED');
            await this.analyzePerformance();
            
        } catch (error) {
            console.error('Delivery monitoring error:', error);
            await this.sm.to('ERROR', 'MONITORING_FAILED');
        }
    }

    /**
     * Analyzes campaign performance and adjusts strategy
     */
    private async analyzePerformance() {
        const currentState = this.vt.getCurrentNode().data;
        
        const analysisPrompt = `Analyze SMS campaign performance and suggest strategy adjustments:
        Performance: ${JSON.stringify(currentState.performance)}
        Current Strategy: ${JSON.stringify(currentState.strategy)}
        
        Suggest strategy adjustments in JSON format.`;
        
        const response = await prompt("You are an SMS marketing strategist.", analysisPrompt, 2000);
        const newStrategy = response.content[0].type === 'text' ? JSON.parse(response.content[0].text) : {};
        
        await this.sm.to('ADJUSTING_STRATEGY', 'ANALYSIS_COMPLETE');
        currentState.strategy = newStrategy;
        
        await this.sm.to('READY', 'STRATEGY_ADJUSTED');
    }

    /**
     * Stops monitoring and cleans up
     */
    stop() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
    }
} 