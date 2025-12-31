import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { OpenAIHelper, type ChatOptions } from "./openAIHelper";

interface SummaryOptions extends ChatOptions {
  customPrompt?: string;
  context?: string;
}

export class SummaryHelper {
  constructor(private readonly openAI: OpenAIHelper) {}

  async summarize(content: string, options: SummaryOptions = {}): Promise<string> {
    const hasContext =
      (options.context && options.context.trim().length > 0) ||
      (content && content.trim().length > 0);

    if (!hasContext) {
      console.warn("[SummaryHelper] summarize called without any content or context");
      return "No content provided.";
    }

    const contextBlock = options.context ?? content;
    const prompt =
      options.customPrompt
        ? `${options.customPrompt}${contextBlock ? `\n\n---\nCONTEXT:\n${contextBlock}` : ""}`
        : `Provide a concise summary of the following content. Focus on key outcomes, failures, and actionable insights.

CONTENT:
${contextBlock}`;
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are an expert technical summarizer." },
      { role: "user", content: prompt },
    ];

    console.log(
      "[SummaryHelper] Invoking OpenAI summary",
      JSON.stringify({
        hasCustomPrompt: Boolean(options.customPrompt),
        contextLength: contextBlock.length,
        model: options.model || "default",
      }),
    );

    try {
      const response = await this.openAI.chat(messages, {
        ...options,
        responseFormat: "text",
        maxCompletionTokens: options.maxCompletionTokens ?? 512,
        temperature: options.temperature ?? 0.4,
      });

      const summary = response.choices[0].message.content?.trim() || "No summary generated.";
      console.log(
        "[SummaryHelper] Summary generated",
        JSON.stringify({ length: summary.length, preview: summary.slice(0, 120) }),
      );
      return summary;
    } catch (error) {
      console.error("[SummaryHelper] OpenAI summary failed:", error);
      throw error;
    }
  }
}
