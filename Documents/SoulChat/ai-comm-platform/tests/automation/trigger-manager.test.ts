import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { TriggerManager } from '../../src/automation/triggers/trigger-manager';
import { FlowEngine } from '../../src/automation/flow-engine';
import type { Flow } from '../../src/types/automation';

function createMockDeps() {
  return {
    channelManager: {
      sendResponse: vi.fn().mockResolvedValue(undefined),
      getAdapter: vi.fn(),
      hasAdapter: vi.fn().mockReturnValue(true),
      registerAdapter: vi.fn(),
      getRegisteredChannels: vi.fn(),
      sendImage: vi.fn(),
      sendButtons: vi.fn(),
      sendTemplate: vi.fn(),
    } as any,
    conversationManager: {
      updateAgent: vi.fn(),
      closeConversation: vi.fn(),
      getConversation: vi.fn(),
    } as any,
    contactManager: {
      getContact: vi.fn().mockReturnValue({ id: 'c1', tags: [] }),
      updateContact: vi.fn(),
      getAllContacts: vi.fn().mockReturnValue([]),
    } as any,
  };
}

describe('TriggerManager', () => {
  let mockEngine: EventEmitter;
  let flowEngine: FlowEngine;
  let triggerManager: TriggerManager;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    mockEngine = new EventEmitter();
    deps = createMockDeps();
    flowEngine = new FlowEngine(deps);
    triggerManager = new TriggerManager(mockEngine as any, flowEngine);
  });

  it('fires conversation_started trigger', async () => {
    const flow: Flow = {
      id: 'f1',
      name: 'Welcome',
      trigger: 'conversation_started',
      triggerConfig: {},
      steps: [{ id: 's1', action: { type: 'add_tag', config: { tag: 'new' } } }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    flowEngine.registerFlow(flow);

    const executeSpy = vi.spyOn(flowEngine, 'executeFlow');

    mockEngine.emit('conversation:started', {
      conversation: { id: 'conv1', channel: 'whatsapp' },
      contact: { id: 'c1', channelUserId: '+123' },
    });

    // Allow async handlers to run
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(executeSpy).toHaveBeenCalledWith('f1', expect.objectContaining({ trigger: 'conversation_started' }));
  });

  it('fires keyword_detected trigger', async () => {
    const flow: Flow = {
      id: 'f2',
      name: 'Keyword Responder',
      trigger: 'keyword_detected',
      triggerConfig: { keywords: ['pricing', 'price'] },
      steps: [{ id: 's1', action: { type: 'send_message', config: { content: 'Check our pricing page!' } } }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    flowEngine.registerFlow(flow);

    const executeSpy = vi.spyOn(flowEngine, 'executeFlow');

    mockEngine.emit('message:incoming', {
      message: { id: 'msg1', content: 'What is your pricing?', channel: 'whatsapp' },
      conversation: { id: 'conv1' },
      contact: { id: 'c1', channelUserId: '+123' },
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(executeSpy).toHaveBeenCalledWith('f2', expect.objectContaining({ trigger: 'keyword_detected' }));
  });

  it('does not fire for inactive flows', async () => {
    const flow: Flow = {
      id: 'f3',
      name: 'Inactive',
      trigger: 'message_received',
      triggerConfig: {},
      steps: [],
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    flowEngine.registerFlow(flow);

    const executeSpy = vi.spyOn(flowEngine, 'executeFlow');

    mockEngine.emit('message:incoming', {
      message: { id: 'msg1', content: 'Hello', channel: 'whatsapp' },
      conversation: { id: 'conv1' },
      contact: { id: 'c1', channelUserId: '+123' },
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('respects channel filter in triggerConfig', async () => {
    const flow: Flow = {
      id: 'f4',
      name: 'Telegram Only',
      trigger: 'message_received',
      triggerConfig: { channel: 'telegram' },
      steps: [{ id: 's1', action: { type: 'add_tag', config: { tag: 'tg' } } }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    flowEngine.registerFlow(flow);

    const executeSpy = vi.spyOn(flowEngine, 'executeFlow');

    // Send from whatsapp — should NOT trigger
    mockEngine.emit('message:incoming', {
      message: { id: 'msg1', content: 'Hello', channel: 'whatsapp' },
      conversation: { id: 'conv1' },
      contact: { id: 'c1', channelUserId: '+123' },
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('stops all cron jobs', () => {
    triggerManager.stopAll();
    // Should not throw
  });
});
