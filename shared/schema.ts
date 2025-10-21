import { z } from "zod";

// S3 data structure schemas based on the documentation
export const taskYamlSchema = z.object({
  instruction: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string(),
  tags: z.array(z.string()),
  parser_name: z.string(),
  max_agent_timeout_sec: z.number(),
});

export const resultsJsonSchema = z.object({
  run_id: z.string(),
  model_name: z.string(),
  accuracy: z.number(),
  start_time: z.string(),
  end_time: z.string(),
  duration_seconds: z.number().optional(),
  task_completed: z.boolean().optional(),
  command_count: z.number().optional(),
  error_count: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export const agentThoughtSchema = z.object({
  timestamp: z.number(),
  type: z.string(), // "i", "o", "m"
  content: z.string(),
});

export const agentCastHeaderSchema = z.object({
  version: z.number(),
  width: z.number(),
  height: z.number(),
  timestamp: z.number(),
  env: z.record(z.string()).optional(),
});

export const s3FileSchema = z.object({
  name: z.string(),
  size: z.number(),
  lastModified: z.string(),
  path: z.string(),
});

export const taskRunSchema = z.object({
  date: z.string(),
  taskId: z.string(),
  modelName: z.string(),
  taskYaml: taskYamlSchema.optional(),
  resultsJson: resultsJsonSchema.optional(),
  agentCast: z.string().optional(), // raw cast content
  taskCheck: z.string().optional(),
  taskDebug: z.string().optional(),
  files: z.array(s3FileSchema).optional(),
});

export const s3HierarchySchema = z.object({
  dates: z.array(z.object({
    date: z.string(),
    tasks: z.array(z.object({
      taskId: z.string(),
      models: z.array(z.object({
        modelName: z.string(),
        accuracy: z.number().optional(),
        hasData: z.boolean(),
      })),
    })),
  })),
});

export type TaskYaml = z.infer<typeof taskYamlSchema>;
export type ResultsJson = z.infer<typeof resultsJsonSchema>;
export type AgentThought = z.infer<typeof agentThoughtSchema>;
export type AgentCastHeader = z.infer<typeof agentCastHeaderSchema>;
export type S3File = z.infer<typeof s3FileSchema>;
export type TaskRun = z.infer<typeof taskRunSchema>;
export type S3Hierarchy = z.infer<typeof s3HierarchySchema>;

// HuggingFace dataset schemas
export const hfDatasetSchema = z.object({
  id: z.string(),
  author: z.string().optional(),
  sha: z.string().optional(),
  lastModified: z.string().optional(),
  private: z.boolean().optional(),
  disabled: z.boolean().optional(),
  gated: z.string().optional(),
  downloads: z.number().optional(),
  likes: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export const hfDatasetRowSchema = z.object({
  row_idx: z.number(),
  row: z.record(z.any()),
  truncated_cells: z.array(z.string()).optional(),
});

export const hfDatasetRowsResponseSchema = z.object({
  features: z.array(z.object({
    feature_idx: z.number(),
    name: z.string(),
    type: z.record(z.any()),
  })),
  rows: z.array(hfDatasetRowSchema),
  num_rows_total: z.number(),
  num_rows_per_page: z.number(),
  partial: z.boolean().optional(),
});

export const tarFileContentSchema = z.object({
  path: z.string(),
  type: z.string(),
  size: z.number(),
  content: z.string().optional(),
});

export const lmJudgeResultSchema = z.object({
  runDetails: z.object({
    config: z.record(z.any()).nullable().optional(),
    result: z.record(z.any()).nullable().optional(),
    exception: z.string().nullable().optional(),
  }).nullable(),
  errorCounts: z.object({
    functionCallError: z.number(),
    malformedJson: z.number(),
    factualComputationalError: z.number(),
    exceededContextWindow: z.number(),
    misunderstoodInstructions: z.number(),
    shellToolMisuse: z.number(),
    noTaskConfirmation: z.number(),
    exhaustedDiskSpace: z.number(),
    hallucinatedSolutions: z.number(),
    systemFailure: z.number(),
    otherAgentError: z.number(),
  }),
  summary: z.string(),
});

export type HfDataset = z.infer<typeof hfDatasetSchema>;
export type HfDatasetRow = z.infer<typeof hfDatasetRowSchema>;
export type HfDatasetRowsResponse = z.infer<typeof hfDatasetRowsResponseSchema>;
export type TarFileContent = z.infer<typeof tarFileContentSchema>;
export type LmJudgeResult = z.infer<typeof lmJudgeResultSchema>;
