import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocxConverter } from '../../src/services/docx-converter';

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

import mammoth from 'mammoth';

function createMockClaude() {
  return {
    chat: vi.fn(),
    chatJSON: vi.fn(),
    getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
    resetUsage: vi.fn(),
  };
}

function createMockLoader() {
  return {
    getData: vi.fn().mockReturnValue(new Map()),
    getEntry: vi.fn(),
    loadAll: vi.fn(),
    loadCategory: vi.fn(),
    reload: vi.fn(),
    validate: vi.fn(),
  };
}

describe('DocxConverter', () => {
  let converter: DocxConverter;
  let mockClaude: ReturnType<typeof createMockClaude>;
  let mockLoader: ReturnType<typeof createMockLoader>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClaude = createMockClaude();
    mockLoader = createMockLoader();
    converter = new DocxConverter(mockClaude as any, mockLoader as any);
  });

  it('should convert a .docx buffer to structured JSON', async () => {
    const fakeText = 'Product A costs $100. Product B costs $200.';
    (mammoth.extractRawText as any).mockResolvedValue({ value: fakeText });

    const convertedData = {
      products: [
        { name: 'Product A', price: 100 },
        { name: 'Product B', price: 200 },
      ],
    };
    mockClaude.chatJSON.mockResolvedValue({
      data: convertedData,
      inputTokens: 50,
      outputTokens: 80,
      model: 'claude-sonnet-4-20250514',
    });

    const result = await converter.convert(Buffer.from('fake-docx'), 'sales');

    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
    expect(mockClaude.chatJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.3,
        maxTokens: 4096,
        messages: [{ role: 'user', content: fakeText }],
      })
    );
    expect(result.extractedText).toBe(fakeText);
    expect(result.convertedData).toEqual(convertedData);
    expect(result.tokenUsage).toEqual({ inputTokens: 50, outputTokens: 80 });
  });

  it('should throw on empty document', async () => {
    (mammoth.extractRawText as any).mockResolvedValue({ value: '' });

    await expect(converter.convert(Buffer.from('fake'), 'sales'))
      .rejects.toThrow('Document is empty or contains no extractable text');
  });

  it('should throw on whitespace-only document', async () => {
    (mammoth.extractRawText as any).mockResolvedValue({ value: '   \n  \t  ' });

    await expect(converter.convert(Buffer.from('fake'), 'support'))
      .rejects.toThrow('Document is empty or contains no extractable text');
  });

  it('should propagate Claude JSON parse failure', async () => {
    (mammoth.extractRawText as any).mockResolvedValue({ value: 'Some document text' });
    mockClaude.chatJSON.mockRejectedValue(new Error('Failed to parse Claude response as JSON'));

    await expect(converter.convert(Buffer.from('fake'), 'company'))
      .rejects.toThrow('Failed to parse Claude response as JSON');
  });

  it('should include format sample from existing brain data', async () => {
    const existingEntries = [
      { subcategory: 'products', data: { products: [{ name: 'Existing' }] } },
    ];
    mockLoader.getData.mockReturnValue(new Map([['sales', existingEntries]]));

    (mammoth.extractRawText as any).mockResolvedValue({ value: 'Some text' });
    mockClaude.chatJSON.mockResolvedValue({
      data: { result: true },
      inputTokens: 10,
      outputTokens: 20,
      model: 'claude-sonnet-4-20250514',
    });

    await converter.convert(Buffer.from('fake'), 'sales');

    const callArgs = mockClaude.chatJSON.mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain('Existing');
  });
});
