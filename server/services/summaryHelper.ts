import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { OpenAIHelper, type ChatOptions } from "./openAIHelper";

interface SummaryOptions extends ChatOptions {
  customPrompt?: string;
  context?: string;
  apiKey?: string;
}

export class SummaryHelper {
  constructor(private readonly openAI: OpenAIHelper) {}

  async summarize(content: string, options: SummaryOptions = {}): Promise<string> {
    // Use session API key if provided, otherwise use default helper
    const helper = options.apiKey ? new OpenAIHelper({ apiKey: options.apiKey }) : this.openAI;

    if (!helper) {
      throw new Error('OPENAI_API_KEY_REQUIRED');
    }
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
      const response = await helper.chat(messages, {
        ...options,
        responseFormat: "text",
        maxCompletionTokens: options.maxCompletionTokens ?? 8192,
        temperature: options.temperature,
        reasoningEffort: options.reasoningEffort ?? "medium",
      });

      const firstChoice = response.choices?.[0];
      const rawContent = firstChoice?.message?.content;
      const extracted = extractMessageText(rawContent);

      if (!extracted) {
        const choicePreview = truncateString(JSON.stringify(firstChoice ?? {}, null, 2), 2000);
        console.warn(
          "[SummaryHelper] Empty summary content from OpenAI",
          JSON.stringify({
            finishReason: firstChoice?.finish_reason,
            hasRefusal: Boolean(firstChoice?.message?.refusal),
            contentTypes: Array.isArray(rawContent) ? rawContent.map((part) => part?.type) : typeof rawContent,
          }),
        );
        console.warn("[SummaryHelper] Raw choice preview:", choicePreview);
        const responsePreview = truncateString(JSON.stringify(response, null, 2), 4000);
        console.warn("[SummaryHelper] Full response preview:", responsePreview);
      }

      const summary =
        extracted ||
        (typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal.trim() : "") ||
        "No summary generated.";
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

function extractMessageText(
  content: string | ChatCompletionContentPart[] | null | undefined,
): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) {
          return "";
        }

        if (typeof part === "string") {
          return part;
        }

        if ("text" in part && typeof part.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function truncateString(value: string, length: number): string {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length)}…[truncated]`;
}
