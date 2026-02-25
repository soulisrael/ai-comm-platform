import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramAdapter } from '../../src/channels/telegram-adapter';

vi.mock('axios', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: { ok: true } }) },
}));

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;

  beforeEach(() => {
    adapter = new TelegramAdapter({
      botToken: 'bot123:ABC',
      secretToken: 'tg_secret',
    });
  });

  describe('name', () => {
    it('returns telegram', () => {
      expect(adapter.name).toBe('telegram');
    });
  });

  describe('sendMessage', () => {
    it('posts to Telegram sendMessage API', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendMessage('chat789', {
        id: 'msg1',
        conversationId: 'conv1',
        contactId: 'c1',
        direction: 'outbound',
        type: 'text',
        content: 'Hello TG!',
        channel: 'telegram',
        metadata: {},
        timestamp: new Date(),
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          chat_id: 'chat789',
          text: 'Hello TG!',
          parse_mode: 'HTML',
        }),
      );
    });
  });

  describe('sendImage', () => {
    it('posts to sendPhoto', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendImage('chat789', 'https://img.example.com/photo.jpg', 'Nice!');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendPhoto'),
        expect.objectContaining({
          chat_id: 'chat789',
          photo: 'https://img.example.com/photo.jpg',
          caption: 'Nice!',
        }),
      );
    });

    it('omits caption if not provided', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendImage('chat789', 'https://img.example.com/photo.jpg');

      const lastCall = (axios.post as any).mock.calls.at(-1);
      expect(lastCall[1]).not.toHaveProperty('caption');
    });
  });

  describe('sendButtons', () => {
    it('sends inline keyboard', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendButtons('chat789', 'Choose:', [
        { id: 'a', title: 'Option A' },
        { id: 'b', title: 'Option B' },
      ]);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Option A', callback_data: 'a' },
                { text: 'Option B', callback_data: 'b' },
              ],
            ],
          },
        }),
      );
    });
  });

  describe('sendTemplate', () => {
    it('sends as plain text', async () => {
      const axios = (await import('axios')).default;
      await adapter.sendTemplate('chat789', 'greeting', { text: 'Welcome!' });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          chat_id: 'chat789',
          text: 'Welcome!',
        }),
      );
    });
  });

  describe('verifyWebhook', () => {
    it('returns true if no secretToken configured', () => {
      const noSecretAdapter = new TelegramAdapter({ secretToken: '' });
      expect(noSecretAdapter.verifyWebhook({})).toBe(true);
    });

    it('validates secret token header', () => {
      expect(adapter.verifyWebhook({ 'x-telegram-bot-api-secret-token': 'tg_secret' })).toBe(true);
    });

    it('rejects wrong token', () => {
      expect(adapter.verifyWebhook({ 'x-telegram-bot-api-secret-token': 'wrong' })).toBe(false);
    });

    it('rejects missing token', () => {
      expect(adapter.verifyWebhook({})).toBe(false);
    });
  });

  describe('parseIncomingMessage', () => {
    it('parses text message', () => {
      const body = {
        message: {
          message_id: 101,
          chat: { id: 12345 },
          from: { first_name: 'Alice', last_name: 'Smith' },
          text: 'Hi bot!',
        },
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result).toEqual({
        channelUserId: '12345',
        content: 'Hi bot!',
        senderName: 'Alice Smith',
        messageId: '101',
        metadata: { tgMessageId: 101, tgChatId: 12345 },
      });
    });

    it('parses photo message', () => {
      const body = {
        message: {
          message_id: 102,
          chat: { id: 12345 },
          from: { first_name: 'Bob' },
          photo: [
            { file_id: 'small', width: 100, height: 100 },
            { file_id: 'large', width: 800, height: 800 },
          ],
          caption: 'Check this out',
        },
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result?.content).toBe('Check this out');
      expect(result?.metadata?.photoFileId).toBe('large');
    });

    it('parses document message', () => {
      const body = {
        message: {
          message_id: 103,
          chat: { id: 12345 },
          from: { first_name: 'Carol' },
          document: { file_id: 'doc1', file_name: 'report.pdf' },
        },
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result?.content).toBe('[Document: report.pdf]');
      expect(result?.metadata?.documentFileId).toBe('doc1');
    });

    it('parses callback query', () => {
      const body = {
        callback_query: {
          id: 'cb_123',
          from: { first_name: 'Dave' },
          message: { chat: { id: 99 } },
          data: 'opt_a',
        },
      };

      const result = adapter.parseIncomingMessage(body);
      expect(result).toEqual({
        channelUserId: '99',
        content: 'opt_a',
        senderName: 'Dave',
        messageId: 'cb_123',
        metadata: { callbackQueryId: 'cb_123', isCallback: true },
      });
    });

    it('returns null for empty/unknown update', () => {
      expect(adapter.parseIncomingMessage({})).toBeNull();
      expect(adapter.parseIncomingMessage({ edited_message: {} })).toBeNull();
    });
  });
});
