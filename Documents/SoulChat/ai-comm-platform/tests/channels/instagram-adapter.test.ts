import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstagramAdapter } from '../../src/channels/instagram-adapter';

vi.mock('axios', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: { success: true } }) },
}));

describe('InstagramAdapter', () => {
  let adapter: InstagramAdapter;

  beforeEach(() => {
    adapter = new InstagramAdapter({
      pageId: 'page123',
      accessToken: 'token123',
      appSecret: 'secret123',
      verifyToken: 'verify123',
    });
  });

  describe('name', () => {
    it('returns instagram', () => {
      expect(adapter.name).toBe('instagram');
    });
  });

  describe('sendMessage', () => {
    it('posts text to Instagram Messaging API', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendMessage('user456', {
        id: 'msg1',
        conversationId: 'conv1',
        contactId: 'c1',
        direction: 'outbound',
        type: 'text',
        content: 'Hello from IG!',
        channel: 'instagram',
        metadata: {},
        timestamp: new Date(),
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          recipient: { id: 'user456' },
          message: { text: 'Hello from IG!' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendImage', () => {
    it('sends image attachment', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendImage('user456', 'https://img.example.com/photo.jpg');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          message: {
            attachment: { type: 'image', payload: { url: 'https://img.example.com/photo.jpg' } },
          },
        }),
        expect.any(Object),
      );
    });

    it('sends caption as separate message', async () => {
      const axios = (await import('axios')).default;
      (axios.post as any).mockClear();
      await adapter.sendImage('user456', 'https://img.example.com/photo.jpg', 'Nice pic!');

      expect(axios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendButtons', () => {
    it('falls back to text (Instagram has limited button support)', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendButtons('user456', 'Choose:', [{ id: '1', title: 'A' }]);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          message: { text: 'Choose:' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendTemplate', () => {
    it('sends with HUMAN_AGENT tag', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendTemplate('user456', 'greet', { text: 'Welcome!' });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          tag: 'HUMAN_AGENT',
          message: { text: 'Welcome!' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('verifyWebhook', () => {
    it('returns true if no appSecret configured', () => {
      const noSecretAdapter = new InstagramAdapter({ appSecret: '' });
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
  });

  describe('parseIncomingMessage', () => {
    it('parses text message', () => {
      const body = {
        entry: [{
          messaging: [{
            sender: { id: 'ig_user_1' },
            message: { mid: 'mid.123', text: 'Hello IG' },
          }],
        }],
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result).toEqual({
        channelUserId: 'ig_user_1',
        content: 'Hello IG',
        messageId: 'mid.123',
        metadata: { igMessageId: 'mid.123' },
      });
    });

    it('parses image attachment', () => {
      const body = {
        entry: [{
          messaging: [{
            sender: { id: 'ig_user_2' },
            message: {
              mid: 'mid.456',
              attachments: [{ type: 'image', payload: { url: 'https://example.com/img.jpg' } }],
            },
          }],
        }],
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result?.content).toBe('[Image]');
      expect(result?.metadata?.attachmentUrl).toBe('https://example.com/img.jpg');
    });

    it('returns null for empty payload', () => {
      expect(adapter.parseIncomingMessage({})).toBeNull();
      expect(adapter.parseIncomingMessage({ entry: [{}] })).toBeNull();
    });

    it('returns null for message without text or attachments', () => {
      const body = {
        entry: [{
          messaging: [{
            sender: { id: 'ig_user_3' },
            message: { mid: 'mid.789' },
          }],
        }],
      };
      expect(adapter.parseIncomingMessage(body)).toBeNull();
    });
  });
});
