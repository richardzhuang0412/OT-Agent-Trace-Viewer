import type { TaskDetail } from "@shared/schema";
import { SummaryHelper } from "./summaryHelper";

const MAX_FILES_PER_TASK = 6;
const MAX_FILE_CHARS = 4000;

export class TaskSummaryHelper {
  constructor(private readonly summaryHelper: SummaryHelper) {}

  async generateDatasetSummary(
    dataset: string,
    tasks: TaskDetail[],
    options?: { model?: string },
  ): Promise<string> {
    if (tasks.length === 0) {
      return "Summary not available.";
    }

    const taskSamples = this.sampleTasks(tasks, 5);
    console.log(
      `[TaskSummaryHelper] Generating summary for dataset "${dataset}" using ${taskSamples.length} sampled tasks`,
    );

    const context = this.buildContext(taskSamples);
    console.log(
      `[TaskSummaryHelper] Context length for dataset "${dataset}": ${context.length} characters`,
    );

    const customPrompt = this.buildPrompt(dataset);

    try {
      const summary = await this.summaryHelper.summarize("", {
        customPrompt,
        context,
        model: options?.model || "gpt-5-mini",
        maxCompletionTokens: 8192,
        reasoningEffort: "medium",
      });

      console.log(
        `[TaskSummaryHelper] Summary generated for dataset "${dataset}" (length: ${summary.length})`,
      );

      return summary;
    } catch (error) {
      console.error(
        `[TaskSummaryHelper] Failed to generate summary for dataset "${dataset}":`,
        error,
      );
      throw error;
    }
  }

  private sampleTasks(tasks: TaskDetail[], count: number): TaskDetail[] {
    if (tasks.length <= count) {
      return tasks;
    }
    const clone = [...tasks];
    const result: TaskDetail[] = [];
    while (result.length < count && clone.length) {
      const idx = Math.floor(Math.random() * clone.length);
      result.push(clone.splice(idx, 1)[0]);
    }
    return result;
  }

  private buildContext(tasks: TaskDetail[]): string {
    return tasks
      .map((task, index) => {
        const header = `===== TASK ${index + 1}: ${task.path} =====`;
        if (!task.files || task.files.length === 0) {
          return `${header}\n(No extracted files)`;
        }

        const fileBlocks = task.files.slice(0, MAX_FILES_PER_TASK).map((file) => {
          const content = file.content
            ? truncate(file.content, MAX_FILE_CHARS)
            : "(binary or unavailable content)";
          return `### ${file.path}\n${content}`;
        });

        return `${header}\n${fileBlocks.join("\n\n")}`;
      })
      .join("\n\n-----\n\n");
  }

  private buildPrompt(dataset: string) {
    return `You are analyzing a Harbor task dataset named "${dataset}". Each task contains serialized files such as instructions, configs, or validation artifacts. The context below lists a small sample of tasks along with the contents of their key files.\n\nYour job is to produce a 6-8 sentence "task dataset overview" that covers:\n1. The kinds of files typically available for this dataset (and what purpose they serve).\n2. The nature and tone of the instructions provided to the agent.\n3. The knowledge domains or technical areas implicated by these tasks.\n\nFocus on high-level insights that would help an engineer understand what working on this dataset feels like. If details conflict, mention the breadth of content rather than picking one example.`;
  }
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.substring(0, length)}\n...[truncated]` : value;
}
