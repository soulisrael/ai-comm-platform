import { EventEmitter } from 'events';
import type { Flow, FlowStep, FlowCondition, FlowExecution } from '../types/automation';
import type { ChannelManager } from '../channels/channel-manager';
import type { ConversationManager } from '../conversation/conversation-manager';
import type { ContactManager } from '../conversation/contact-manager';
import { MemoryStore } from '../conversation/memory-store';
import {
  executeSendMessage,
  executeAddTag,
  executeRemoveTag,
  executeAssignAgent,
  executeWait,
  executeWebhook,
  executeUpdateContact,
  executeCloseConversation,
} from './actions';
import logger from '../services/logger';

export interface FlowEngineDeps {
  channelManager: ChannelManager;
  conversationManager: ConversationManager;
  contactManager: ContactManager;
}

export class FlowEngine extends EventEmitter {
  private flows = new MemoryStore<Flow>();
  private executions = new MemoryStore<FlowExecution>();
  private deps: FlowEngineDeps;
  private delayHandler?: (executionId: string, stepId: string, delayMs: number) => void;

  constructor(deps: FlowEngineDeps) {
    super();
    this.deps = deps;
  }

  setDelayHandler(handler: (executionId: string, stepId: string, delayMs: number) => void): void {
    this.delayHandler = handler;
  }

  registerFlow(flow: Flow): void {
    this.flows.create(flow);
    logger.info(`Flow registered: ${flow.id} (${flow.name})`);
    this.emit('flow:registered', { flow });
  }

  getFlow(flowId: string): Flow | undefined {
    return this.flows.get(flowId);
  }

  getAllFlows(): Flow[] {
    return this.flows.getAll();
  }

  getActiveFlows(): Flow[] {
    return this.flows.find(f => f.active);
  }

  updateFlow(flowId: string, updates: Partial<Flow>): Flow {
    return this.flows.update(flowId, { ...updates, updatedAt: new Date() });
  }

  deleteFlow(flowId: string): boolean {
    return this.flows.delete(flowId);
  }

  activateFlow(flowId: string): Flow {
    return this.flows.update(flowId, { active: true, updatedAt: new Date() });
  }

  deactivateFlow(flowId: string): Flow {
    return this.flows.update(flowId, { active: false, updatedAt: new Date() });
  }

  getExecution(executionId: string): FlowExecution | undefined {
    return this.executions.get(executionId);
  }

  getExecutionsByFlow(flowId: string): FlowExecution[] {
    return this.executions.find(e => e.flowId === flowId);
  }

  async executeFlow(flowId: string, context: Record<string, any>): Promise<FlowExecution> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    if (!flow.active) {
      throw new Error(`Flow is not active: ${flowId}`);
    }

    const execution: FlowExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      flowId,
      conversationId: context.conversationId,
      contactId: context.contactId,
      status: 'running',
      currentStepId: flow.steps[0]?.id,
      context: { ...context, flowId },
      startedAt: new Date(),
    };

    this.executions.create(execution);
    this.emit('execution:started', { execution, flow });
    logger.info(`Flow execution started: ${execution.id} for flow ${flow.name}`);

    try {
      await this.runSteps(flow, execution);
    } catch (err: any) {
      execution.status = 'failed';
      execution.error = err.message;
      execution.completedAt = new Date();
      this.executions.update(execution.id, execution);
      this.emit('execution:failed', { execution, error: err });
      logger.error(`Flow execution failed: ${execution.id}`, { error: err.message });
    }

    return this.executions.get(execution.id)!;
  }

  private async runSteps(flow: Flow, execution: FlowExecution): Promise<void> {
    let currentStep = flow.steps.find(s => s.id === execution.currentStepId);
    if (!currentStep && flow.steps.length > 0) {
      currentStep = flow.steps[0];
    }

    while (currentStep) {
      execution.currentStepId = currentStep.id;
      this.executions.update(execution.id, execution);

      // Check conditions
      if (currentStep.conditions && currentStep.conditions.length > 0) {
        const conditionsMet = this.evaluateConditions(currentStep.conditions, execution.context);
        if (!conditionsMet) {
          logger.debug(`Step ${currentStep.id}: conditions not met, skipping`);
          currentStep = this.getNextStep(flow, currentStep);
          continue;
        }
      }

      // Execute the step
      const result = await this.executeStep(currentStep, execution.context);

      // Handle wait/delay — pause execution and let BullMQ resume
      if (result?.delay) {
        if (this.delayHandler) {
          const nextStep = this.getNextStep(flow, currentStep);
          if (nextStep) {
            execution.currentStepId = nextStep.id;
            this.executions.update(execution.id, execution);
            this.delayHandler(execution.id, nextStep.id, result.delay);
          }
        }
        return; // Pause execution — will be resumed after delay
      }

      this.emit('step:completed', { execution, step: currentStep });

      // Move to next step
      currentStep = this.getNextStep(flow, currentStep);
    }

    // All steps completed
    execution.status = 'completed';
    execution.completedAt = new Date();
    this.executions.update(execution.id, execution);
    this.emit('execution:completed', { execution });
    logger.info(`Flow execution completed: ${execution.id}`);
  }

  async resumeExecution(executionId: string, stepId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') return;

    const flow = this.flows.get(execution.flowId);
    if (!flow) return;

    execution.currentStepId = stepId;
    this.executions.update(executionId, execution);

    await this.runSteps(flow, execution);
  }

  async executeStep(
    step: FlowStep,
    context: Record<string, any>,
  ): Promise<{ delay?: number } | void> {
    const { type, config } = step.action;
    logger.debug(`Executing step ${step.id}: ${type}`, { config });

    switch (type) {
      case 'send_message':
        await executeSendMessage(config, context, this.deps.channelManager);
        break;
      case 'send_image':
        await executeSendMessage({ ...config, type: 'image' }, context, this.deps.channelManager);
        break;
      case 'add_tag':
        executeAddTag(config, context, this.deps.contactManager);
        break;
      case 'remove_tag':
        executeRemoveTag(config, context, this.deps.contactManager);
        break;
      case 'assign_agent':
        executeAssignAgent(config, context, this.deps.conversationManager);
        break;
      case 'wait': {
        const result = executeWait(config);
        return { delay: result.delayMs };
      }
      case 'webhook':
        await executeWebhook(config, context);
        break;
      case 'update_contact':
        executeUpdateContact(config, context, this.deps.contactManager);
        break;
      case 'close_conversation':
        executeCloseConversation(config, context, this.deps.conversationManager);
        break;
      case 'start_conversation':
        // start_conversation uses the engine — handled at trigger level
        logger.info('start_conversation action: handled externally');
        break;
      default:
        logger.warn(`Unknown action type: ${type}`);
    }
  }

  evaluateConditions(conditions: FlowCondition[], context: Record<string, any>): boolean {
    return conditions.every(c => this.evaluateCondition(c, context));
  }

  private evaluateCondition(condition: FlowCondition, context: Record<string, any>): boolean {
    const fieldValue = this.resolveField(condition.field, context);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return typeof fieldValue === 'string' && typeof condition.value === 'string'
          && fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      case 'gt':
        return typeof fieldValue === 'number' && typeof condition.value === 'number'
          && fieldValue > condition.value;
      case 'lt':
        return typeof fieldValue === 'number' && typeof condition.value === 'number'
          && fieldValue < condition.value;
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }

  private resolveField(field: string, context: Record<string, any>): any {
    const parts = field.split('.');
    let value: any = context;
    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }
    return value;
  }

  private getNextStep(flow: Flow, currentStep: FlowStep): FlowStep | undefined {
    if (currentStep.nextStepId) {
      return flow.steps.find(s => s.id === currentStep.nextStepId);
    }
    // Default: next step in sequence
    const idx = flow.steps.findIndex(s => s.id === currentStep.id);
    return idx >= 0 && idx < flow.steps.length - 1 ? flow.steps[idx + 1] : undefined;
  }
}
