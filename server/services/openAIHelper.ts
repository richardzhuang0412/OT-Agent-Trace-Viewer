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
  private client: OpenAI;

  constructor(options: ClientOptions = {}) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[OpenAIHelper] OPENAI_API_KEY is not set. Requests will fail.');
    }

    this.client = new OpenAI({ ...options, apiKey });
  }

  async chat(messages: ChatCompletionMessageParam[], options: ChatOptions = {}) {
    return this.client.chat.completions.create({
      model: options.model || DEFAULT_MODEL,
      messages,
      response_format: options.responseFormat ? { type: options.responseFormat } : undefined,
      max_completion_tokens: options.maxCompletionTokens,
      reasoning_effort: options.reasoningEffort,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    });
  }
}
