import OpenAI, { type ClientOptions } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface ChatOptions {
  model?: string;
  temperature?: number;
  responseFormat?: 'text' | 'json_object';
  maxCompletionTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

const DEFAULT_MODEL = 'gpt-5-nano';

export class OpenAIHelper {
  private client: OpenAI | null = null;
  private apiKey: string | undefined;
  private options: ClientOptions;

  constructor(options: ClientOptions = {}) {
    // Extract API key - ensure it's a string
    const providedKey = options.apiKey;
    this.apiKey = (typeof providedKey === 'string' ? providedKey : undefined) || process.env.OPENAI_API_KEY;
    this.options = options;

    if (!this.apiKey) {
      console.warn('[OpenAIHelper] OPENAI_API_KEY is not set. Requests will fail.');
    }
  }

  private getClient(): OpenAI {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY_REQUIRED');
    }

    if (!this.client) {
      this.client = new OpenAI({ ...this.options, apiKey: this.apiKey });
    }

    return this.client;
  }

  async chat(messages: ChatCompletionMessageParam[], options: ChatOptions = {}) {
    const client = this.getClient();

    return client.chat.completions.create({
      model: options.model || DEFAULT_MODEL,
      messages,
      response_format: options.responseFormat ? { type: options.responseFormat } : undefined,
      max_completion_tokens: options.maxCompletionTokens,
      reasoning_effort: options.reasoningEffort,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    });
  }

  /**
   * Validates an API key by making a lightweight API call.
   * Returns true if the key is valid, false otherwise.
   */
  static async validateKey(apiKey: string): Promise<boolean> {
    try {
      const testHelper = new OpenAIHelper({ apiKey });
      // Make a minimal API call to test the key
      const response = await testHelper.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'gpt-5-nano', maxCompletionTokens: 5 }
      );
      return response.choices.length > 0;
    } catch (error) {
      console.warn('[OpenAIHelper] API key validation failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
}
