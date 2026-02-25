import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppAdapter } from '../../src/channels/whatsapp-adapter';

// Mock axios
vi.mock('axios', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: { success: true } }) },
}));

describe('WhatsAppAdapter', () => {
  let adapter: WhatsAppAdapter;

  beforeEach(() => {
    adapter = new WhatsAppAdapter({
      phoneNumberId: 'phone123',
      accessToken: 'token123',
      appSecret: 'secret123',
      verifyToken: 'verify123',
    });
  });

  describe('name', () => {
    it('returns whatsapp', () => {
      expect(adapter.name).toBe('whatsapp');
    });
  });

  describe('sendMessage', () => {
    it('posts text message to WhatsApp API', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendMessage('+1234567890', {
        id: 'msg1',
        conversationId: 'conv1',
        contactId: 'c1',
        direction: 'outbound',
        type: 'text',
        content: 'Hello!',
        channel: 'whatsapp',
        metadata: {},
        timestamp: new Date(),
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          messaging_product: 'whatsapp',
          to: '+1234567890',
          type: 'text',
          text: { body: 'Hello!' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendImage', () => {
    it('posts image message with caption', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendImage('+1234567890', 'https://img.example.com/photo.jpg', 'A photo');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          type: 'image',
          image: { link: 'https://img.example.com/photo.jpg', caption: 'A photo' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendButtons', () => {
    it('posts interactive button message', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendButtons('+1234567890', 'Choose one:', [
        { id: 'opt1', title: 'Option 1' },
        { id: 'opt2', title: 'Option 2' },
      ]);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          type: 'interactive',
          interactive: expect.objectContaining({
            type: 'button',
            body: { text: 'Choose one:' },
          }),
        }),
        expect.any(Object),
      );
    });

    it('truncates button titles to 20 chars and limits to 3 buttons', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendButtons('+1234567890', 'Pick:', [
        { id: '1', title: 'A very long button title here' },
        { id: '2', title: 'B' },
        { id: '3', title: 'C' },
        { id: '4', title: 'D (should be dropped)' },
      ]);

      const call = (axios.post as any).mock.calls.at(-1);
      const buttons = call[1].interactive.action.buttons;
      expect(buttons).toHaveLength(3);
      expect(buttons[0].reply.title).toHaveLength(20);
    });
  });

  describe('sendTemplate', () => {
    it('posts template message', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendTemplate('+1234567890', 'welcome_msg', { language: 'en', components: [] });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          type: 'template',
          template: { name: 'welcome_msg', language: { code: 'en' }, components: [] },
        }),
        expect.any(Object),
      );
    });
  });

  describe('verifyWebhook', () => {
    it('returns true if no appSecret configured', () => {
      const noSecretAdapter = new WhatsAppAdapter({ appSecret: '' });
      expect(noSecretAdapter.verifyWebhook({}, {})).toBe(true);
    });

    it('returns false if signature header missing', () => {
      expect(adapter.verifyWebhook({}, {})).toBe(false);
    });

    it('validates HMAC SHA-256 signature', () => {
      const crypto = require('crypto');
      const body = JSON.stringify({ test: true });
      const sig = 'sha256=' + crypto.createHmac('sha256', 'secret123').update(body).digest('hex');

      expect(adapter.verifyWebhook({ 'x-hub-signature-256': sig }, body)).toBe(true);
    });

    it('rejects invalid signature', () => {
      expect(adapter.verifyWebhook({ 'x-hub-signature-256': 'sha256=invalid' }, '{}')).toBe(false);
    });
  });

  describe('parseIncomingMessage', () => {
    it('parses text message', () => {
      const body = {
        entry: [{
          changes: [{
            value: {
              messages: [{ id: 'wamid1', from: '+1111111111', type: 'text', text: { body: 'Hi there' } }],
              contacts: [{ profile: { name: 'John' } }],
            },
          }],
        }],
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result).toEqual({
        channelUserId: '+1111111111',
        content: 'Hi there',
        senderName: 'John',
        messageId: 'wamid1',
        metadata: { waMessageId: 'wamid1', type: 'text' },
      });
    });

    it('parses image message', () => {
      const body = {
        entry: [{
          changes: [{
            value: {
              messages: [{ id: 'wamid2', from: '+2222222222', type: 'image', image: { id: 'img1', caption: 'Look!' } }],
              contacts: [{ profile: { name: 'Jane' } }],
            },
          }],
        }],
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result?.content).toBe('Look!');
      expect(result?.metadata?.imageId).toBe('img1');
    });

    it('parses interactive button_reply', () => {
      const body = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                id: 'wamid3', from: '+3333333333', type: 'interactive',
                interactive: { type: 'button_reply', button_reply: { id: 'opt1', title: 'Option 1' } },
              }],
              contacts: [{ profile: { name: 'Bob' } }],
            },
          }],
        }],
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result?.content).toBe('Option 1');
      expect(result?.metadata?.buttonId).toBe('opt1');
    });

    it('returns null for empty payload', () => {
      expect(adapter.parseIncomingMessage({})).toBeNull();
      expect(adapter.parseIncomingMessage({ entry: [] })).toBeNull();
    });
  });
});
