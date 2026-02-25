import { describe, it, expect } from 'vitest';
import {
  Message,
  IncomingMessage,
  OutgoingMessage,
  createMessage,
  isIncomingMessage,
  isOutgoingMessage,
} from '../../src/types/message';

describe('Message types', () => {
  const baseParams = {
    conversationId: 'conv-1',
    contactId: 'contact-1',
    type: 'text' as const,
    content: 'Hello!',
    channel: 'whatsapp' as const,
    metadata: {},
  };

  it('should create an inbound message', () => {
    const msg = createMessage({ ...baseParams, direction: 'inbound' });

    expect(msg.id).toBeDefined();
    expect(msg.direction).toBe('inbound');
    expect(msg.content).toBe('Hello!');
    expect(msg.channel).toBe('whatsapp');
    expect(msg.timestamp).toBeInstanceOf(Date);
  });

  it('should create an outbound message', () => {
    const msg = createMessage({ ...baseParams, direction: 'outbound' });

    expect(msg.id).toBeDefined();
    expect(msg.direction).toBe('outbound');
    expect(msg.content).toBe('Hello!');
  });

  it('should allow custom id and timestamp', () => {
    const customDate = new Date('2025-01-01');
    const msg = createMessage({
      ...baseParams,
      direction: 'inbound',
      id: 'custom-id',
      timestamp: customDate,
    });

    expect(msg.id).toBe('custom-id');
    expect(msg.timestamp).toBe(customDate);
  });

  describe('type guards', () => {
    it('isIncomingMessage returns true for inbound messages', () => {
      const msg = createMessage({ ...baseParams, direction: 'inbound' });
      expect(isIncomingMessage(msg)).toBe(true);
      expect(isOutgoingMessage(msg)).toBe(false);
    });

    it('isOutgoingMessage returns true for outbound messages', () => {
      const msg = createMessage({ ...baseParams, direction: 'outbound' });
      expect(isOutgoingMessage(msg)).toBe(true);
      expect(isIncomingMessage(msg)).toBe(false);
    });
  });

  describe('interface compliance', () => {
    it('IncomingMessage has direction inbound', () => {
      const msg: IncomingMessage = {
        id: '1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        direction: 'inbound',
        type: 'text',
        content: 'Hi',
        channel: 'whatsapp',
        metadata: {},
        timestamp: new Date(),
      };
      expect(msg.direction).toBe('inbound');
    });

    it('OutgoingMessage has direction outbound', () => {
      const msg: OutgoingMessage = {
        id: '2',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        direction: 'outbound',
        type: 'text',
        content: 'Reply',
        channel: 'telegram',
        metadata: {},
        timestamp: new Date(),
      };
      expect(msg.direction).toBe('outbound');
    });
  });
});
