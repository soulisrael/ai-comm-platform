import mammoth from 'mammoth';
import { ClaudeAPI } from './claude-api';
import { BrainCategory } from '../types/brain';
import { BrainLoader } from '../brain/brain-loader';
import logger from './logger';

export interface ConversionResult {
  extractedText: string;
  convertedData: Record<string, unknown>;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

export class DocxConverter {
  private claude: ClaudeAPI;
  private loader: BrainLoader;

  constructor(claude: ClaudeAPI, loader: BrainLoader) {
    this.claude = claude;
    this.loader = loader;
  }

  async convert(
    fileBuffer: Buffer,
    category: BrainCategory,
    subcategory?: string
  ): Promise<ConversionResult> {
    // Extract raw text from .docx
    const { value: extractedText } = await mammoth.extractRawText({ buffer: fileBuffer });

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Document is empty or contains no extractable text');
    }

    // Get a sample of existing brain data in the target category for format guidance
    const existingEntries = this.loader.getData().get(category) || [];
    let formatSample = '';
    if (existingEntries.length > 0) {
      const sample = existingEntries[0];
      const sampleStr = JSON.stringify(sample.data, null, 2);
      // Limit sample size to avoid blowing up the prompt
      formatSample = sampleStr.length > 2000 ? sampleStr.slice(0, 2000) + '\n...' : sampleStr;
    }

    const systemPrompt = `You are a document-to-JSON converter for a business knowledge base.
Convert the provided document text into structured JSON that can be used by AI agents.

Category: ${category}${subcategory ? `\nSubcategory: ${subcategory}` : ''}

Rules:
- Extract all meaningful information from the document
- Organize into logical sections with descriptive keys
- Use camelCase for JSON keys
- Arrays for lists of items, objects for grouped data
- Preserve all important details, numbers, names, and dates
- If the document contains Q&A pairs, structure as { "faqs": [{ "question": "...", "answer": "...", "keywords": [...] }] }
- If the document contains product info, structure as { "products": [{ "name": "...", "description": "...", ... }] }
- For general documents, use { "title": "...", "sections": [{ "heading": "...", "content": "..." }], "keyPoints": [...] }
- Return ONLY valid JSON, no markdown or explanation

${formatSample ? `Here is an example of existing data in this category for format reference:\n${formatSample}` : ''}`;

    const result = await this.claude.chatJSON<Record<string, unknown>>({
      systemPrompt,
      messages: [{ role: 'user', content: extractedText }],
      temperature: 0.3,
      maxTokens: 4096,
    });

    logger.info('Document converted successfully', {
      category,
      subcategory,
      textLength: extractedText.length,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    return {
      extractedText,
      convertedData: result.data,
      tokenUsage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    };
  }
}
