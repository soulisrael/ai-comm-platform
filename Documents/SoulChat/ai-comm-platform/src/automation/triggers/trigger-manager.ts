import { Cron } from 'croner';
import type { ConversationEngine } from '../../conversation/conversation-engine';
import type { FlowEngine } from '../flow-engine';
import type { Flow } from '../../types/automation';
import logger from '../../services/logger';

export class TriggerManager {
  private engine: ConversationEngine;
  private flowEngine: FlowEngine;
  private cronJobs = new Map<string, Cron>();

  constructor(engine: ConversationEngine, flowEngine: FlowEngine) {
    this.engine = engine;
    this.flowEngine = flowEngine;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.engine.on('message:incoming', ({ message, conversation, contact }) => {
      this.checkTrigger('message_received', {
        conversationId: conversation.id,
        contactId: contact.id,
        channel: message.channel,
        channelUserId: contact.channelUserId,
        content: message.content,
        messageId: message.id,
      });

      // Also check keyword triggers
      this.checkKeywordTriggers(message.content, {
        conversationId: conversation.id,
        contactId: contact.id,
        channel: message.channel,
        channelUserId: contact.channelUserId,
        content: message.content,
      });
    });

    this.engine.on('conversation:started', ({ conversation, contact }) => {
      this.checkTrigger('conversation_started', {
        conversationId: conversation.id,
        contactId: contact.id,
        channel: conversation.channel,
        channelUserId: contact.channelUserId,
      });
    });

    this.engine.on('conversation:closed', ({ conversation, contact }) => {
      this.checkTrigger('conversation_closed', {
        conversationId: conversation?.id,
        contactId: contact?.id,
        channel: conversation?.channel,
      });
    });

    this.engine.on('conversation:handoff', ({ conversation, contact }) => {
      this.checkTrigger('handoff_resolved', {
        conversationId: conversation?.id,
        contactId: contact?.id,
        channel: conversation?.channel,
      });
    });

    logger.info('TriggerManager: event listeners attached');
  }

  registerScheduledFlows(): void {
    const flows = this.flowEngine.getActiveFlows();
    for (const flow of flows) {
      if (flow.trigger === 'scheduled') {
        this.registerCronJob(flow);
      }
    }
  }

  registerCronJob(flow: Flow): void {
    const cron = flow.triggerConfig?.cron;
    if (!cron) {
      logger.warn(`Scheduled flow ${flow.id} has no cron expression`);
      return;
    }

    // Remove existing job if any
    this.removeCronJob(flow.id);

    const job = new Cron(cron, () => {
      logger.info(`Cron trigger fired for flow: ${flow.name}`);
      this.flowEngine.executeFlow(flow.id, {
        trigger: 'scheduled',
        scheduledAt: new Date().toISOString(),
      }).catch(err => logger.error(`Cron flow execution failed: ${err.message}`));
    });

    this.cronJobs.set(flow.id, job);
    logger.info(`Cron job registered for flow ${flow.name}: ${cron}`);
  }

  removeCronJob(flowId: string): void {
    const existing = this.cronJobs.get(flowId);
    if (existing) {
      existing.stop();
      this.cronJobs.delete(flowId);
    }
  }

  private checkTrigger(triggerType: string, context: Record<string, any>): void {
    const flows = this.flowEngine.getActiveFlows().filter(f => f.trigger === triggerType);

    for (const flow of flows) {
      // Check trigger-specific config
      if (!this.matchesTriggerConfig(flow, context)) continue;

      logger.info(`Trigger matched: ${flow.name} (${triggerType})`);
      this.flowEngine.executeFlow(flow.id, { ...context, trigger: triggerType })
        .catch(err => logger.error(`Flow execution failed for trigger ${triggerType}: ${err.message}`));
    }
  }

  private checkKeywordTriggers(content: string, context: Record<string, any>): void {
    const flows = this.flowEngine.getActiveFlows().filter(f => f.trigger === 'keyword_detected');
    const lower = content.toLowerCase();

    for (const flow of flows) {
      const keywords = (flow.triggerConfig?.keywords || []) as string[];
      const matched = keywords.some(kw => lower.includes(kw.toLowerCase()));

      if (matched) {
        logger.info(`Keyword trigger matched: ${flow.name}`);
        this.flowEngine.executeFlow(flow.id, { ...context, trigger: 'keyword_detected' })
          .catch(err => logger.error(`Keyword flow execution failed: ${err.message}`));
      }
    }
  }

  private matchesTriggerConfig(flow: Flow, context: Record<string, any>): boolean {
    const cfg = flow.triggerConfig || {};

    // Channel filter
    if (cfg.channel && context.channel && cfg.channel !== context.channel) return false;

    // Business hours filter
    if (cfg.outsideBusinessHours) {
      const hour = new Date().getHours();
      const start = cfg.businessHoursStart ?? 9;
      const end = cfg.businessHoursEnd ?? 17;
      if (hour >= start && hour < end) return false; // Inside business hours — skip
    }

    return true;
  }

  stopAll(): void {
    for (const [id, job] of this.cronJobs) {
      job.stop();
      this.cronJobs.delete(id);
    }
    logger.info('TriggerManager: all cron jobs stopped');
  }
}
