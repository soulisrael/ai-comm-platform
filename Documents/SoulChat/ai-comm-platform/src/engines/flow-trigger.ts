import { FlowRepository } from '../database/repositories/flow-repository';
import { Flow } from '../types/flow';
import { FlowEngine } from './flow-engine';
import logger from '../services/logger';

export type TriggerEvent = 'message_received' | 'new_contact' | 'keyword' | 'webhook' | 'manual' | 'schedule';

export interface TriggerData {
  conversationId?: string;
  contactId?: string;
  message?: string;
  channel?: string;
  webhookId?: string;
  payload?: Record<string, unknown>;
}

export class FlowTriggerManager {
  private flowRepo: FlowRepository;
  private flowEngine: FlowEngine;

  constructor(flowRepo: FlowRepository, flowEngine: FlowEngine) {
    this.flowRepo = flowRepo;
    this.flowEngine = flowEngine;
  }

  /**
   * Check all active flows for matching triggers and start them.
   */
  async checkTriggers(event: TriggerEvent, data: TriggerData): Promise<string[]> {
    // Returns array of started flow run IDs
    const flows = await this.flowRepo.getByTrigger(event);
    const startedRuns: string[] = [];

    for (const flow of flows) {
      if (this.matchesTrigger(flow, event, data)) {
        try {
          const run = await this.flowEngine.startFlow(
            flow.id,
            data.conversationId,
            data.contactId,
            { ...data.payload, message: data.message, channel: data.channel },
          );
          startedRuns.push(run.id);
          logger.info(`Trigger ${event} started flow "${flow.name}" (run: ${run.id})`);
        } catch (err) {
          logger.error(`Failed to start flow "${flow.name}" on trigger ${event}:`, err);
        }
      }
    }

    return startedRuns;
  }

  /**
   * Check if a flow's trigger config matches the event data.
   */
  private matchesTrigger(flow: Flow, event: TriggerEvent, data: TriggerData): boolean {
    const config = flow.triggerConfig;

    switch (event) {
      case 'keyword': {
        const keywords = (config.keywords as string[]) || [];
        const message = (data.message || '').toLowerCase();
        return keywords.some(kw => message.includes(kw.toLowerCase()));
      }
      case 'webhook':
        return config.webhookId === data.webhookId;
      case 'new_contact':
      case 'message_received':
      case 'manual':
        return true; // These triggers always match active flows
      case 'schedule':
        return false; // Scheduled triggers are handled by cron, not event-based
      default:
        return false;
    }
  }

  /**
   * Manually trigger a flow.
   */
  async manualTrigger(flowId: string, data: TriggerData): Promise<string> {
    const run = await this.flowEngine.startFlow(flowId, data.conversationId, data.contactId, data.payload);
    return run.id;
  }

  /**
   * Handle incoming webhook trigger.
   */
  async handleWebhookTrigger(webhookId: string, payload: Record<string, unknown>): Promise<string[]> {
    return this.checkTriggers('webhook', { webhookId, payload });
  }
}
