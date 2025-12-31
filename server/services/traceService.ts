import axios from 'axios';
import type {
  AtifTrace,
  AtifTurn,
  ParsedTurn,
  TraceFilterParams,
  TraceListResponse,
  TraceMetadata,
  HfDatasetRowsResponse,
} from '@shared/schema';
import { atifTraceSchema, traceFilterParamsSchema, traceListResponseSchema } from '@shared/schema';
import { HfService } from './hfService';

export class TraceService {
  private hfService: HfService;
  private datasetCache: Map<string, AtifTrace[]> = new Map();
  private metadataCache: Map<string, TraceMetadata> = new Map();

  constructor() {
    this.hfService = new HfService();
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

      return {
        traces: paginatedTraces,
        total,
        nextOffset: offset + limit < total ? offset + limit : undefined,
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
      console.log('[TraceService] Cache cleared for dataset:', dataset);
    } else {
      this.datasetCache.clear();
      this.metadataCache.clear();
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
