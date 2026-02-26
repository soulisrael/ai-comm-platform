import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WhatsAppSender } from '../../src/services/wa-sender';

vi.mock('../../src/services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();

describe('WhatsAppSender', () => {
  let sender: WhatsAppSender;

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    sender = new WhatsAppSender({
      phoneNumberId: '123456',
      accessToken: 'test-token',
      apiVersion: 'v21.0',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSuccessResponse(messageId = 'wamid.abc123') {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: messageId }] }),
    });
  }

  function mockErrorResponse(status = 400, message = 'Invalid parameter') {
    mockFetch.mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ error: { message } }),
    });
  }

  describe('sendMessage', () => {
    it('builds correct payload and returns success', async () => {
      mockSuccessResponse('wamid.text123');

      const result = await sender.sendMessage('972501234567', 'Hello');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.text123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/123456/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '972501234567',
            type: 'text',
            text: { body: 'Hello' },
          }),
        })
      );
    });

    it('returns error on API failure', async () => {
      mockErrorResponse(400, 'Invalid phone number');

      const result = await sender.sendMessage('invalid', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await sender.sendMessage('972501234567', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('sendTemplate', () => {
    it('sends template without parameters', async () => {
      mockSuccessResponse('wamid.tpl123');

      const result = await sender.sendTemplate('972501234567', 'welcome_message', 'he');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.tpl123');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('template');
      expect(body.template.name).toBe('welcome_message');
      expect(body.template.language.code).toBe('he');
      expect(body.template.components).toBeUndefined();
    });

    it('sends template with parameters', async () => {
      mockSuccessResponse('wamid.tpl456');

      const result = await sender.sendTemplate(
        '972501234567',
        'order_confirmation',
        'he',
        [{ order_id: '12345' }, { total: '99.90' }]
      );

      expect(result.success).toBe(true);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template.components).toHaveLength(1);
      expect(body.template.components[0].type).toBe('body');
      expect(body.template.components[0].parameters).toEqual([
        { type: 'text', text: '12345' },
        { type: 'text', text: '99.90' },
      ]);
    });

    it('defaults language code to Hebrew (he)', async () => {
      mockSuccessResponse();

      await sender.sendTemplate('972501234567', 'test_template');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template.language.code).toBe('he');
    });
  });

  describe('sendMediaMessage', () => {
    it('sends image message with caption', async () => {
      mockSuccessResponse('wamid.img123');

      const result = await sender.sendMediaMessage(
        '972501234567',
        'https://example.com/image.jpg',
        'image',
        'Product photo'
      );

      expect(result.success).toBe(true);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('image');
      expect(body.image.link).toBe('https://example.com/image.jpg');
      expect(body.image.caption).toBe('Product photo');
    });

    it('sends document without caption', async () => {
      mockSuccessResponse('wamid.doc123');

      const result = await sender.sendMediaMessage(
        '972501234567',
        'https://example.com/doc.pdf',
        'document'
      );

      expect(result.success).toBe(true);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('document');
      expect(body.document.link).toBe('https://example.com/doc.pdf');
      expect(body.document.caption).toBeUndefined();
    });

    it('sends video message', async () => {
      mockSuccessResponse('wamid.vid123');

      const result = await sender.sendMediaMessage(
        '972501234567',
        'https://example.com/video.mp4',
        'video',
        'Demo video'
      );

      expect(result.success).toBe(true);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('video');
      expect(body.video.link).toBe('https://example.com/video.mp4');
    });
  });

  describe('sendTypingIndicator', () => {
    it('sends read receipt', async () => {
      mockSuccessResponse();

      await sender.sendTypingIndicator('972501234567');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messaging_product).toBe('whatsapp');
      expect(body.status).toBe('read');
    });

    it('does not throw on failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(sender.sendTypingIndicator('972501234567')).resolves.toBeUndefined();
    });
  });

  describe('validateBeforeSend', () => {
    it('allows template messages regardless of window state', () => {
      expect(sender.validateBeforeSend(false, 'template')).toEqual({ canSend: true });
      expect(sender.validateBeforeSend(true, 'template')).toEqual({ canSend: true });
    });

    it('allows text messages when window is open', () => {
      expect(sender.validateBeforeSend(true, 'text')).toEqual({ canSend: true });
    });

    it('blocks text messages when window is closed', () => {
      const result = sender.validateBeforeSend(false, 'text');
      expect(result.canSend).toBe(false);
      expect(result.reason).toContain('\u05D7\u05DC\u05D5\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA');
    });

    it('allows media messages when window is open', () => {
      expect(sender.validateBeforeSend(true, 'media')).toEqual({ canSend: true });
    });

    it('blocks media messages when window is closed', () => {
      const result = sender.validateBeforeSend(false, 'media');
      expect(result.canSend).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('uses default API version when not specified', async () => {
      const senderDefault = new WhatsAppSender({
        phoneNumberId: '789',
        accessToken: 'tok',
      });

      mockSuccessResponse();
      await senderDefault.sendMessage('123', 'test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/789/messages',
        expect.anything()
      );
    });

    it('uses custom API version when specified', async () => {
      const senderCustom = new WhatsAppSender({
        phoneNumberId: '789',
        accessToken: 'tok',
        apiVersion: 'v22.0',
      });

      mockSuccessResponse();
      await senderCustom.sendMessage('123', 'test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v22.0/789/messages',
        expect.anything()
      );
    });
  });
});
