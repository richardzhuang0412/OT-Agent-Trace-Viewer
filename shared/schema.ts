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

// ATIF (Agent Trace Format) trace schemas
export const atifTurnSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const atifTraceSchema = z.object({
  // Metadata fields
  agent: z.string(),
  model: z.string(),
  model_provider: z.string(),
  date: z.string(),
  task: z.string(),
  episode: z.union([z.string(), z.number()]),
  run_id: z.string(),
  trial_name: z.string(),
  tool_definitions: z.any().optional(),
  result: z.union([z.number(), z.string()]).optional(),
  trace_source: z.string().optional(),

  // Conversation data
  conversations: z.array(atifTurnSchema),
});

// Parsed/structured turn for display
export const parsedTurnSchema = z.object({
  role: z.string(),
  sections: z.object({
    thoughts: z.string().optional(),
    actions: z.string().optional(),
    observations: z.string().optional(),
    results: z.string().optional(),
    raw: z.string(),
  }),
});

// Filter parameters for querying traces
export const traceFilterParamsSchema = z.object({
  run_id: z.string().optional(),
  model: z.string().optional(),
  task: z.string().optional(),
  trial_name: z.string().optional(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

export const evalBenchmarkSchema = z.enum([
  'dev_set_71_tasks',
  'terminal_bench_2',
  'swebench-verified-random-100-folders',
]);

export const traceDatasetKindSchema = z.enum(['training', 'eval']);

export const traceDatasetInfoSchema = z.object({
  dataset: z.string(),
  namespace: z.string().optional(),
  repository: z.string(),
  kind: traceDatasetKindSchema,
  benchmark: evalBenchmarkSchema.optional(),
  warning: z.string().optional(),
  score: z
    .object({
      earned: z.number(),
      total: z.number(),
    })
    .optional(),
  successful_tasks: z.array(z.string()).optional(),
});

// Response for trace list endpoint
export const traceListResponseSchema = z.object({
  traces: z.array(atifTraceSchema),
  total: z.number(),
  nextOffset: z.number().optional(),
  dataset_info: traceDatasetInfoSchema,
});

// Metadata for filter dropdowns/options
export const traceMetadataSchema = z.object({
  models: z.array(z.string()),
  tasks: z.array(z.string()),
  agents: z.array(z.string()),
  trial_names: z.array(z.string()),
  results: z.array(z.string()).optional(),
  dataset_info: traceDatasetInfoSchema,
});

export type AtifTurn = z.infer<typeof atifTurnSchema>;
export type AtifTrace = z.infer<typeof atifTraceSchema>;
export type ParsedTurn = z.infer<typeof parsedTurnSchema>;
export type TraceFilterParams = z.infer<typeof traceFilterParamsSchema>;
export type TraceListResponse = z.infer<typeof traceListResponseSchema>;
export type TraceMetadata = z.infer<typeof traceMetadataSchema>;
export type EvalBenchmark = z.infer<typeof evalBenchmarkSchema>;
export type TraceDatasetInfo = z.infer<typeof traceDatasetInfoSchema>;
export type TraceDatasetKind = z.infer<typeof traceDatasetKindSchema>;

// Task dataset schemas for HuggingFace task parquet datasets
export const extractedFileSchema = z.object({
  path: z.string(),
  content: z.string().optional(), // Only for text files
  size: z.number(),
  isText: z.boolean(),
});

export const taskDetailSchema = z.object({
  path: z.string(),
  files: z.array(extractedFileSchema),
});

export const taskListResponseSchema = z.object({
  tasks: z.array(taskDetailSchema),
  total: z.number(),
  nextOffset: z.number().optional(),
  summary: z.string().optional(),
  summaryError: z.string().optional(),
});

export type ExtractedFile = z.infer<typeof extractedFileSchema>;
export type TaskDetail = z.infer<typeof taskDetailSchema>;
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;
