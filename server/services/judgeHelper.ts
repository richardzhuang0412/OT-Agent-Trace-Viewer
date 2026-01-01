import type { TarFileContent, LmJudgeResult } from "@shared/schema";
import { lmJudgeResultSchema } from "@shared/schema";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { OpenAIHelper, type ChatOptions } from "./openAIHelper";

interface JudgePromptOptions extends ChatOptions {
  customPrompt?: string;
  contextLabel?: string;
  context?: string;
}

export class JudgeHelper {
  constructor(private readonly openAI: OpenAIHelper) {}

  async analyzeTarContents(
    tarContents: TarFileContent[],
    options: JudgePromptOptions = {},
  ): Promise<LmJudgeResult> {
    const context = buildTarPromptContext(
      tarContents,
      options.customPrompt,
      options.context,
    );

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are an expert test analyzer who identifies failures and issues in test runs. Respond with valid JSON only.",
      },
      { role: "user", content: context.prompt },
    ];

    const response = await this.openAI.chat(messages, {
      ...options,
      responseFormat: "json_object",
      maxCompletionTokens: options.maxCompletionTokens ?? 4096,
    });

    return parseJudgeResponse(response.choices[0].message.content, context);
  }

  async analyzeRows(rows: any[], options: JudgePromptOptions = {}): Promise<LmJudgeResult> {
    const prompt =
      options.customPrompt ?? buildRowsPrompt(rows, options.contextLabel, options.context);

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are an expert agent communication analyzer who identifies failures and issues in agent interactions. Respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ];

    const response = await this.openAI.chat(messages, {
      ...options,
      responseFormat: "json_object",
      maxCompletionTokens: options.maxCompletionTokens ?? 4096,
    });

    return parseJudgeResponse(response.choices[0].message.content);
  }
}

function buildTarPromptContext(
  tarContents: TarFileContent[],
  customPrompt?: string,
  additionalContext?: string,
) {
  const configFile = tarContents.find((f) => f.path.endsWith("config.json"));
  const resultFile = tarContents.find((f) => f.path.endsWith("result.json"));
  const exceptionFile = tarContents.find((f) => f.path.endsWith("exception.txt"));

  let configData: any = null;
  let resultData: any = null;
  const exceptionData = exceptionFile?.content || null;

  if (configFile?.content) {
    try {
      configData = JSON.parse(configFile.content);
    } catch (error) {
      console.error("Failed to parse config.json:", error);
    }
  }

  if (resultFile?.content) {
    try {
      resultData = JSON.parse(resultFile.content);
    } catch (error) {
      console.error("Failed to parse result.json:", error);
    }
  }

  const contentsForAnalysis = tarContents
    .filter((f) => f.content)
    .map(
      (f) =>
        `File: ${f.path}\nType: ${f.type}\nSize: ${f.size}\n\nContent:\n${f.content?.substring(0, 20_000)}`,
    )
    .join("\n\n---\n\n");

  const basePrompt =
    customPrompt ??
    defaultTarPrompt(contentsForAnalysis, configData, resultData, exceptionData);

  const prompt = additionalContext
    ? `${basePrompt}\n\nADDITIONAL CONTEXT:\n${additionalContext}`
    : basePrompt;

  return { prompt, configData, resultData };
}

function defaultTarPrompt(
  contents: string,
  configData: any,
  resultData: any,
  exceptionData: string | null,
) {
  return `You are an expert test analyzer. Analyze the following extracted tar file contents from a test run and identify ALL errors that occurred.

FILES CONTENT:
${contents}

KEY FILES EXTRACTED:
- Config: ${configData ? JSON.stringify(configData, null, 2) : "Not found"}
- Result: ${resultData ? JSON.stringify(resultData, null, 2) : "Not found"}
- Exception: ${exceptionData || "Not found"}

${ERROR_ANALYSIS_RULES}`;
}

function buildRowsPrompt(
  rows: any[],
  contextLabel?: string,
  additionalContext?: string,
) {
  const label = contextLabel ?? `${rows.length} rows`;
  const rowsForAnalysis = rows
    .map((row, idx) => `Row ${row.row_idx ?? idx}:\n${JSON.stringify(row.row, null, 2)}`)
    .join("\n\n---\n\n");

  const basePrompt = `You are an expert agent communication analyzer. Analyze the following dataset rows (${label}) and identify ALL errors that occurred.

${rowsForAnalysis}

${ERROR_ANALYSIS_RULES}`;

  return additionalContext
    ? `${basePrompt}\n\nADDITIONAL CONTEXT:\n${additionalContext}`
    : basePrompt;
}

const ERROR_ANALYSIS_RULES = `ANALYSIS STEPS:
1. Review all artifacts for indications of failure
2. Use the error taxonomy to classify each failure
3. Count unique occurrences for each category
4. Return 0 for categories with no findings

ERROR TAXONOMY:
1. functionCallError – Invalid function usage (missing params, wrong signatures)
2. malformedJson – JSON parsing or formatting issues
3. factualComputationalError – Incorrect math/logic or assertion failures
4. exceededContextWindow – Token/context limit exceeded errors
5. misunderstoodInstructions – Agent misinterprets task requirements
6. shellToolMisuse – Shell/CLI misuse (command not found, permission denied)
7. noTaskConfirmation – Agent never confirms completion when requested
8. exhaustedDiskSpace – Disk full / ENOSPC issues
9. hallucinatedSolutions – Placeholder or fabricated work claimed as done
10. systemFailure – Infrastructure or runtime crashes (OOM, segfaults, timeouts)
11. otherAgentError – Anything else agent-related

Format your response as JSON:
{
  "errorCounts": { ...taxonomy },
  "summary": "<brief summary>"
}`;

function ensureNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function parseJudgeResponse(
  content: string | null | undefined,
  context?: { configData?: any; resultData?: any },
): LmJudgeResult {
  let raw: any = {};
  try {
    raw = content ? JSON.parse(content) : {};
  } catch (error) {
    console.error("[JudgeHelper] Failed to parse judge response:", error);
  }

  const errorCounts = {
    functionCallError: ensureNumber(raw.errorCounts?.functionCallError),
    malformedJson: ensureNumber(raw.errorCounts?.malformedJson),
    factualComputationalError: ensureNumber(raw.errorCounts?.factualComputationalError),
    exceededContextWindow: ensureNumber(raw.errorCounts?.exceededContextWindow),
    misunderstoodInstructions: ensureNumber(raw.errorCounts?.misunderstoodInstructions),
    shellToolMisuse: ensureNumber(raw.errorCounts?.shellToolMisuse),
    noTaskConfirmation: ensureNumber(raw.errorCounts?.noTaskConfirmation),
    exhaustedDiskSpace: ensureNumber(raw.errorCounts?.exhaustedDiskSpace),
    hallucinatedSolutions: ensureNumber(raw.errorCounts?.hallucinatedSolutions),
    systemFailure: ensureNumber(raw.errorCounts?.systemFailure),
    otherAgentError: ensureNumber(raw.errorCounts?.otherAgentError),
  };

  let summary = raw.summary || "";
  if (!summary && context?.configData) {
    const datasetLink =
      context.configData?.task?.dataset_link ||
      context.configData?.task?.link ||
      context.configData?.dataset_link ||
      context.configData?.link ||
      '';

    let agent = '';
    if (context.configData?.agent) {
      agent =
        typeof context.configData.agent === 'string'
          ? context.configData.agent
          : context.configData.agent.name ||
            context.configData.agent.model ||
            '';
    } else if (context.configData?.model) {
      agent =
        typeof context.configData.model === 'string'
          ? context.configData.model
          : context.configData.model.name || '';
    }

    const parts: string[] = [];
    if (datasetLink) parts.push(`Dataset: ${datasetLink}`);
    if (agent) parts.push(`Agent: ${agent}`);
    summary = parts.length ? parts.join(' | ') : 'No summary available';
  }

  if (!summary) summary = "No summary available";

  return lmJudgeResultSchema.parse({
    runDetails: null,
    errorCounts,
    summary,
  });
}
