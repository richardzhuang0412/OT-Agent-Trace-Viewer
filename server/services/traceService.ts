import axios from 'axios';
import type {
  AtifTrace,
  AtifTurn,
  EvalBenchmark,
  ParsedTurn,
  TraceDatasetKind,
  TraceDatasetInfo,
  TraceFilterParams,
  TraceListResponse,
  TraceMetadata,
  HfDatasetRowsResponse,
} from '@shared/schema';
import { atifTraceSchema, traceFilterParamsSchema, traceListResponseSchema } from '@shared/schema';
import { HfService } from './hfService';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OpenAIHelper } from './openAIHelper';

const EVAL_BENCHMARKS: { key: EvalBenchmark; slug: string; label: string }[] = [
  { key: 'dev_set_71_tasks', slug: 'dev_set_71_tasks', label: 'Dev Set 71 Tasks' },
  { key: 'terminal_bench_2', slug: 'terminal_bench_2', label: 'Terminal Bench 2' },
  { key: 'swebench-verified-random-100-folders', slug: 'swebench-verified-random-100-folders', label: 'SWE-bench Verified 100' },
];

export class TraceService {
  private hfService: HfService;
  private datasetCache: Map<string, AtifTrace[]> = new Map();
  private metadataCache: Map<string, TraceMetadata> = new Map();
  private datasetInfoCache: Map<string, TraceDatasetInfo> = new Map();
  private openAIHelper?: OpenAIHelper;

  constructor(openAIHelper?: OpenAIHelper) {
    this.hfService = new HfService();
    this.openAIHelper = openAIHelper;
  }

  /**
   * Fetch and filter traces from a HuggingFace dataset
   * Supports pagination and filtering by metadata fields
   */
  async listTraces(dataset: string, filters: TraceFilterParams): Promise<TraceListResponse> {
    try {
      console.log('[TraceService] Fetching traces from dataset:', dataset);
      console.log('[TraceService] Filters:', filters);

      // Validate filters
      const validatedFilters = traceFilterParamsSchema.parse(filters);
      const { limit = 50, offset = 0, ...filterParams } = validatedFilters;

      // Check cache first - if no filters, use cached data
      let allTraces = this.datasetCache.get(dataset);
      if (!allTraces) {
        allTraces = await this.fetchAllTraces(dataset);
        this.datasetCache.set(dataset, allTraces);
      }

      // Apply filters
      let filtered = this.applyFilters(allTraces, filterParams);
      const total = filtered.length;

      // Apply pagination
      const paginatedTraces = filtered.slice(offset, offset + limit);

      const datasetInfo = this.getDatasetInfo(dataset, allTraces);

      return {
        traces: paginatedTraces,
        total,
        nextOffset: offset + limit < total ? offset + limit : undefined,
        dataset_info: datasetInfo,
      };
    } catch (error) {
      console.error('[TraceService] Error listing traces:', error);
      throw error;
    }
  }

  /**
   * Get a single trace by run_id
   */
  async getTrace(dataset: string, runId: string): Promise<AtifTrace | null> {
    try {
      console.log('[TraceService] Fetching single trace:', runId);

      let allTraces = this.datasetCache.get(dataset);
      if (!allTraces) {
        allTraces = await this.fetchAllTraces(dataset);
        this.datasetCache.set(dataset, allTraces);
      }

      const trace = allTraces.find((t) => t.run_id === runId);
      return trace || null;
    } catch (error) {
      console.error('[TraceService] Error fetching trace:', error);
      throw error;
    }
  }

  async judgeTrace(dataset: string, runId: string, apiKey?: string): Promise<{ analysis: string }> {
    // Use session API key if provided, otherwise use default helper
    const helper = apiKey ? new OpenAIHelper({ apiKey }) : this.openAIHelper;

    if (!helper) {
      throw new Error('OPENAI_API_KEY_REQUIRED');
    }

    const trace = await this.getTrace(dataset, runId);
    if (!trace) {
      throw new Error('Trace not found');
    }

    const prompt = this.buildJudgePrompt(trace);
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are an expert evaluation judge for agent traces. Provide clear, actionable reasoning about success or failure.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await helper.chat(messages, {
      model:
        process.env.TRACE_JUDGE_MODEL ||
        process.env.TASK_SUMMARY_MODEL ||
        'gpt-5-mini',
      maxCompletionTokens: 8192,
      reasoningEffort: 'medium',
    });

    const content = response.choices[0]?.message?.content?.trim();
    return {
      analysis: content || 'No analysis generated.',
    };
  }

  /**
   * Get metadata about traces (distinct values for filtering)
   */
  async getMetadata(dataset: string): Promise<TraceMetadata> {
    try {
      // Check cache first
      const cached = this.metadataCache.get(dataset);
      if (cached) {
        return cached;
      }

      let allTraces = this.datasetCache.get(dataset);
      if (!allTraces) {
        allTraces = await this.fetchAllTraces(dataset);
        this.datasetCache.set(dataset, allTraces);
      }

      const unique = <T,>(items: T[]): T[] =>
        items.filter((value, index, self) => self.indexOf(value) === index);

      const metadata: TraceMetadata = {
        models: unique(allTraces.map((t) => t.model)),
        tasks: unique(allTraces.map((t) => t.task)),
        agents: unique(allTraces.map((t) => t.agent)),
        trial_names: unique(allTraces.map((t) => t.trial_name)),
        results: unique(allTraces.map((t) => this.stringifyResult(t.result))),
        dataset_info: this.getDatasetInfo(dataset, allTraces),
      };

      this.metadataCache.set(dataset, metadata);
      return metadata;
    } catch (error) {
      console.error('[TraceService] Error fetching metadata:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific dataset or all datasets
   */
  clearCache(dataset?: string): void {
    if (dataset) {
      this.datasetCache.delete(dataset);
      this.metadataCache.delete(dataset);
      this.datasetInfoCache.delete(dataset);
      console.log('[TraceService] Cache cleared for dataset:', dataset);
    } else {
      this.datasetCache.clear();
      this.metadataCache.clear();
      this.datasetInfoCache.clear();
      console.log('[TraceService] All caches cleared');
    }
  }

  /**
   * Private: Fetch all traces from HuggingFace dataset
   * Handles pagination to load all rows
   */
  private async fetchAllTraces(dataset: string): Promise<AtifTrace[]> {
    const traces: AtifTrace[] = [];
    let offset = 0;
    const pageSize = 100;
    let totalFetched = 0;
    let maxRetries = 5;

    try {
      while (totalFetched < 10000) {
        // Safety limit
        try {
          console.log(`[TraceService] Fetching batch at offset ${offset}...`);
          const response = await this.hfService.getDatasetRows(dataset, 'default', 'train', offset, pageSize);

          if (!response.rows || response.rows.length === 0) {
            console.log('[TraceService] No more rows to fetch');
            break;
          }

          // Parse and validate each row as an ATIF trace
          for (const hfRow of response.rows) {
            const rowData = hfRow.row;
            const trace = this.parseAtifTrace(rowData);
            if (trace) {
              traces.push(trace);
            }
          }

          totalFetched += response.rows.length;
          console.log(`[TraceService] Fetched ${response.rows.length} rows, total so far: ${totalFetched}`);

          // Check if there are more rows
          if (totalFetched >= response.num_rows_total) {
            console.log(`[TraceService] Reached end of dataset (${response.num_rows_total} total rows)`);
            break;
          }

          offset += pageSize;
          maxRetries = 5; // Reset retries on success
        } catch (error) {
          console.error('[TraceService] Error fetching batch at offset', offset, ':', error);
          maxRetries--;

          if (maxRetries <= 0) {
            console.error('[TraceService] Max retries exceeded, stopping fetch');
            break;
          }

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      console.log(`[TraceService] Successfully fetched ${traces.length} total traces`);
      return traces;
    } catch (error) {
      console.error('[TraceService] Fatal error fetching all traces:', error);
      throw new Error(`Failed to fetch traces from dataset ${dataset}`);
    }
  }

  /**
   * Private: Parse and validate a single row as ATIF trace
   */
  private parseAtifTrace(rowData: any): AtifTrace | null {
    try {
      // Handle nested structure - sometimes the trace data is nested under a 'trace' key
      const data = rowData.trace || rowData;

      if (typeof data?.trace_source === 'string' && data.trace_source !== 'main') {
        return null;
      }

      // Validate against schema
      const trace = atifTraceSchema.parse(data);
      return trace;
    } catch (error) {
      console.warn('[TraceService] Failed to parse row as ATIF trace:', error);
      return null;
    }
  }

  /**
   * Private: Apply filters to traces
   */
  private getDatasetInfo(dataset: string, traces?: AtifTrace[]): TraceDatasetInfo {
    const cached = this.datasetInfoCache.get(dataset);
    if (cached && !traces) {
      return cached;
    }

    let sourceTraces = traces;
    if (!sourceTraces) {
      sourceTraces = this.datasetCache.get(dataset);
    }

    const info = this.classifyDataset(dataset, sourceTraces ?? []);
    this.datasetInfoCache.set(dataset, info);
    return info;
  }

  private classifyDataset(dataset: string, traces: AtifTrace[]): TraceDatasetInfo {
    const segments = dataset.split('/');
    const repository = segments.pop() ?? dataset;
    const namespace = segments.length ? segments.join('/') : undefined;
    const normalizedRepo = repository.toLowerCase();

    const baseInfo: TraceDatasetInfo = {
      dataset,
      namespace,
      repository,
      kind: 'training',
    };

    const looksEval =
      normalizedRepo.startsWith('dcagent_') && /[0-9a-f]+$/.test(normalizedRepo);

    if (looksEval) {
      const benchmarkMatch = this.findBenchmark(normalizedRepo);
      if (benchmarkMatch) {
        const enriched = this.computeEvalDetails(traces);
        return {
          ...baseInfo,
          kind: 'eval',
          benchmark: benchmarkMatch.key,
          ...(enriched && {
            score: enriched.score,
            successful_tasks: enriched.successfulTasks,
          }),
        };
      }

      return {
        ...baseInfo,
        warning: 'Dataset name matches DCAgent_* pattern but benchmark slug is unrecognized. Treating as training.',
      };
    }

    return baseInfo;
  }

  private findBenchmark(repoName: string): { key: EvalBenchmark; slug: string; label: string } | undefined {
    return EVAL_BENCHMARKS.find(({ slug }) => repoName.includes(slug));
  }

  private computeEvalDetails(traces: AtifTrace[] | undefined) {
    if (!traces || traces.length === 0) {
      return null;
    }

    const total = traces.length;
    let earned = 0;
    const successfulTasks = new Set<string>();

    for (const trace of traces) {
      const reward = this.getRewardValue(trace.result);
      if (reward > 0) {
        successfulTasks.add(trace.task);
      }
      earned += reward;
    }

    return {
      score: {
        earned,
        total,
      },
      successfulTasks: Array.from(successfulTasks).sort(),
    };
  }

  private buildJudgePrompt(trace: AtifTrace): string {
    const resultText =
      trace.result !== undefined
        ? typeof trace.result === 'string'
          ? trace.result
          : trace.result.toString()
        : 'Unknown';

    const conversation = trace.conversations
      .map(
        (turn, idx) =>
          `Turn ${idx + 1} — ${turn.role.toUpperCase()}:\n${turn.content}`,
      )
      .join('\n\n');

    return `Analyze the following agent trace and explain why it ${
      this.getRewardValue(trace.result) > 0 ? 'succeeded' : 'failed'
    }.

Dataset metadata:
- Run ID: ${trace.run_id}
- Task: ${trace.task}
- Agent: ${trace.agent}
- Model: ${trace.model}
- Result (reward or outcome): ${resultText}

Provide:
1. A concise verdict stating whether the run was a success or failure.
2. Key evidence from the dialogue supporting that verdict.
3. The primary reasons for the outcome (strategy, tooling, errors, etc.).
4. Concrete guidance on how to improve the run if it failed.

FULL CONVERSATION:
${conversation}`;
  }

  private getRewardValue(result: unknown): number {
    if (typeof result === 'number' && Number.isFinite(result)) {
      return result;
    }

    if (typeof result === 'string') {
      const parsed = parseFloat(result);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  private stringifyResult(result: unknown): string {
    if (result === undefined || result === null) {
      return 'N/A';
    }
    if (typeof result === 'number') {
      return Number.isFinite(result) ? result.toString() : 'NaN';
    }
    return String(result);
  }

  private applyFilters(traces: AtifTrace[], filters: Partial<TraceFilterParams>): AtifTrace[] {
    return traces.filter((trace) => {
      if (filters.run_id && !trace.run_id.includes(filters.run_id)) {
        return false;
      }
      if (filters.model && !trace.model.includes(filters.model)) {
        return false;
      }
      if (filters.task && !trace.task.includes(filters.task)) {
        return false;
      }
      if (filters.trial_name && !trace.trial_name.includes(filters.trial_name)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Parse a single turn's content into structured sections
   * Identifies patterns for thoughts, actions, observations, results
   */
  parseAtifTurn(turn: AtifTurn): ParsedTurn {
    const content = turn.content;
    const sections: ParsedTurn['sections'] = {
      raw: content,
    };

    // Pattern matching for different sections
    // This is a basic implementation - can be enhanced with more sophisticated parsing

    // Extract thoughts
    const thoughtMatch = content.match(/(?:^|\n)\s*(?:Thought|Analysis|Let me|I think|I should)[\s:]+([\s\S]*?)(?=\n(?:Action|Observation|Tool|Result)|$)/i);
    if (thoughtMatch) {
      sections.thoughts = thoughtMatch[1].trim();
    }

    // Extract actions (including tool calls, function calls, etc.)
    const actionMatch = content.match(/(?:^|\n)\s*(?:Action|Tool call|Function call|Execute)[\s:]+([\s\S]*?)(?=\n(?:Observation|Result|Tool result)|$)/i);
    if (actionMatch) {
      sections.actions = actionMatch[1].trim();
    }

    // Extract observations
    const observationMatch = content.match(/(?:^|\n)\s*(?:Observation|Tool result|Output)[\s:]+([\s\S]*?)(?=\n(?:Action|Thought|Result|Analysis)|$)/i);
    if (observationMatch) {
      sections.observations = observationMatch[1].trim();
    }

    // Extract results/conclusions
    const resultMatch = content.match(/(?:^|\n)\s*(?:Result|Conclusion|Final answer|Response)[\s:]+([\s\S]*?)$/i);
    if (resultMatch) {
      sections.results = resultMatch[1].trim();
    }

    return {
      role: turn.role,
      sections,
    };
  }
}
