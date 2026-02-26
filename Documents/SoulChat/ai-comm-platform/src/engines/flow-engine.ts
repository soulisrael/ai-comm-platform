import { FlowRepository } from '../database/repositories/flow-repository';
import { Flow, FlowNode, FlowEdge, FlowRun } from '../types/flow';
import { ConditionEvaluator } from './condition-evaluator';
import logger from '../services/logger';

export class FlowEngine {
  private flowRepo: FlowRepository;
  private conditionEvaluator: ConditionEvaluator;
  // Optional dependency injection for node executors
  private sendMessage?: (conversationId: string, text: string) => Promise<void>;
  private runAgent?: (agentId: string, message: string, conversationId: string) => Promise<string>;
  private updateContact?: (contactId: string, tags: string[]) => Promise<void>;

  constructor(
    flowRepo: FlowRepository,
    options?: {
      sendMessage?: (conversationId: string, text: string) => Promise<void>;
      runAgent?: (agentId: string, message: string, conversationId: string) => Promise<string>;
      updateContact?: (contactId: string, tags: string[]) => Promise<void>;
    },
  ) {
    this.flowRepo = flowRepo;
    this.conditionEvaluator = new ConditionEvaluator();
    this.sendMessage = options?.sendMessage;
    this.runAgent = options?.runAgent;
    this.updateContact = options?.updateContact;
  }

  /**
   * Start a flow execution.
   */
  async startFlow(
    flowId: string,
    conversationId?: string,
    contactId?: string,
    triggerData?: Record<string, unknown>,
  ): Promise<FlowRun> {
    const flow = await this.flowRepo.getById(flowId);
    if (!flow) throw new Error(`Flow ${flowId} not found`);
    if (!flow.active) throw new Error(`Flow ${flowId} is not active`);

    const run = await this.flowRepo.createRun(flowId, conversationId, contactId);

    // Find the trigger node (entry point)
    const triggerNode = flow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) throw new Error(`Flow ${flowId} has no trigger node`);

    // Initialize context
    const context: Record<string, unknown> = { ...triggerData, conversationId, contactId };
    await this.flowRepo.updateRun(run.id, { current_node_id: triggerNode.id, context });

    // Execute from trigger node
    await this.executeFromNode(flow, run.id, triggerNode, context);

    return run;
  }

  /**
   * Execute a node and move to the next one.
   */
  private async executeFromNode(
    flow: Flow,
    runId: string,
    node: FlowNode,
    context: Record<string, unknown>,
  ): Promise<void> {
    logger.info(`Flow ${flow.id} executing node ${node.id} (${node.type})`);

    await this.flowRepo.updateRun(runId, { current_node_id: node.id, context });

    try {
      const result = await this.executeNode(node, context);

      // Merge result into context
      if (result) Object.assign(context, result);

      // If node requested a pause, stop execution
      if (result?._pause) {
        await this.flowRepo.updateRun(runId, { status: 'paused', context });
        logger.info(`Flow ${flow.id} run ${runId} paused at node ${node.id}`);
        return;
      }

      // Find next node(s)
      const outputHandle = result?.outputHandle as string | undefined;
      const nextNode = this.findNextNode(flow, node, outputHandle);

      if (nextNode) {
        await this.executeFromNode(flow, runId, nextNode, context);
      } else {
        // No more nodes — flow completed
        await this.flowRepo.updateRun(runId, { status: 'completed', completed_at: new Date().toISOString() });
        await this.flowRepo.updateStats(flow.id, 'success');
        logger.info(`Flow ${flow.id} run ${runId} completed`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.flowRepo.updateRun(runId, { status: 'failed', error: errorMsg, completed_at: new Date().toISOString() });
      await this.flowRepo.updateStats(flow.id, 'failed');
      logger.error(`Flow ${flow.id} run ${runId} failed at node ${node.id}: ${errorMsg}`);
    }
  }

  /**
   * Execute a single node based on its type.
   */
  private async executeNode(
    node: FlowNode,
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    switch (node.type) {
      case 'trigger':
        return null; // Entry point, just pass through

      case 'send_message': {
        const message = node.data.message as string;
        const conversationId = context.conversationId as string;
        if (this.sendMessage && conversationId && message) {
          await this.sendMessage(conversationId, message);
        }
        return null;
      }

      case 'ai_agent': {
        const agentId = node.data.agentId as string;
        const conversationId = context.conversationId as string;
        const lastMessage = (context.lastMessage as string) || '';
        if (this.runAgent && agentId) {
          const response = await this.runAgent(agentId, lastMessage, conversationId);
          return { aiResponse: response };
        }
        return null;
      }

      case 'wait_reply':
        // Pause the flow — will be resumed when customer replies
        return { _pause: true };

      case 'delay': {
        const delayMs =
          (node.data.delayMs as number) || (node.data.delaySeconds as number || 0) * 1000;
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 30000))); // cap at 30s for sync
        }
        return null;
      }

      case 'condition': {
        const expression = (node.data.expression as string) || (node.data.condition as string) || '';
        const result = this.conditionEvaluator.evaluate(expression, context);
        return { outputHandle: result ? 'yes' : 'no' };
      }

      case 'human_handoff':
        return { _handoff: true, handoffReason: node.data.reason || 'Flow triggered handoff' };

      case 'tag': {
        const tags =
          (node.data.tags as string[]) || [node.data.tag as string].filter(Boolean);
        const contactId = context.contactId as string;
        if (this.updateContact && contactId && tags.length > 0) {
          await this.updateContact(contactId, tags);
        }
        return null;
      }

      case 'http_request': {
        const url = node.data.url as string;
        const method = (node.data.method as string) || 'GET';
        if (url) {
          try {
            const resp = await fetch(url, {
              method,
              headers: (node.data.headers as Record<string, string>) || {},
            });
            const body = await resp.json();
            return { httpResponse: body, httpStatus: resp.status };
          } catch (err) {
            return { httpError: String(err) };
          }
        }
        return null;
      }

      case 'close':
        return { _close: true };

      case 'transfer_agent': {
        const targetAgentId = node.data.agentId as string;
        return { transferToAgent: targetAgentId };
      }

      case 'check_window': {
        // Check if 24h window is open — caller should set windowOpen in context
        const isOpen = (context.windowOpen as boolean) ?? true;
        return { outputHandle: isOpen ? 'open' : 'closed' };
      }

      default:
        logger.warn(`Unknown node type: ${node.type}`);
        return null;
    }
  }

  /**
   * Find the next node following an edge from the current node.
   */
  private findNextNode(flow: Flow, currentNode: FlowNode, outputHandle?: string): FlowNode | null {
    let edge: FlowEdge | undefined;

    if (outputHandle) {
      // For condition nodes, match by sourceHandle
      edge = flow.edges.find(e => e.source === currentNode.id && e.sourceHandle === outputHandle);
    }

    if (!edge) {
      // Default: first edge from this node
      edge = flow.edges.find(e => e.source === currentNode.id);
    }

    if (!edge) return null;
    return flow.nodes.find(n => n.id === edge!.target) || null;
  }

  /**
   * Pause a running flow.
   */
  async pauseFlow(runId: string): Promise<void> {
    await this.flowRepo.updateRun(runId, { status: 'paused' });
  }

  /**
   * Resume a paused flow from its current node.
   */
  async resumeFlow(runId: string, _additionalContext?: Record<string, unknown>): Promise<void> {
    // Implementation: load run, find current node, continue execution
    // This is a stub for now — full implementation needs the flow run data
    void runId;
  }

  /**
   * Cancel a running flow.
   */
  async cancelFlow(runId: string): Promise<void> {
    await this.flowRepo.updateRun(runId, {
      status: 'failed',
      error: 'Cancelled',
      completed_at: new Date().toISOString(),
    });
  }
}
