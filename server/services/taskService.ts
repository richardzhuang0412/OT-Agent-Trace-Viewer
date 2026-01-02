import * as tar from 'tar';
import { Readable } from 'stream';
import type { ExtractedFile, TaskDetail, TaskListResponse } from '@shared/schema';
import { HfService } from './hfService';
import { TaskSummaryHelper } from './taskSummaryHelper';

export class TaskService {
  private taskCache: Map<string, TaskDetail[]> = new Map();

  constructor(
    private hfService: HfService = new HfService(),
    private taskSummaryHelper?: TaskSummaryHelper,
  ) {}

  /**
   * List tasks from a HuggingFace dataset with pagination
   * NOTE: For now, we only fetch the requested page to avoid rate limits
   */
  async listTasks(
    dataset: string,
    limit: number = 50,
    offset: number = 0,
    options?: { apiKey?: string; skipSummary?: boolean }
  ): Promise<TaskListResponse> {
    try {
      console.log(`[TaskService] Fetching tasks from dataset: ${dataset}`);
      console.log(`[TaskService] Pagination: limit=${limit}, offset=${offset}`);

      // Fetch only the requested page directly from HuggingFace
      const { tasks, totalRows } = await this.fetchPagedTasks(dataset, limit, offset);

      // Prefer the HuggingFace-reported total row count when available
      const total = typeof totalRows === 'number'
        ? totalRows
        : offset + tasks.length + (tasks.length === limit ? 1 : 0);

      let summary: string | undefined;
      let summaryError: string | undefined;

      // Only generate summary if not skipped
      if (!options?.skipSummary && this.taskSummaryHelper) {
        try {
          summary = await this.taskSummaryHelper.generateDatasetSummary(dataset, tasks, {
            model: process.env.TASK_SUMMARY_MODEL || "gpt-5-mini",
            apiKey: options?.apiKey,
          });
        } catch (error: any) {
          // Check if error is due to missing API key
          if (error?.message === 'OPENAI_API_KEY_REQUIRED') {
            summaryError = 'OPENAI_API_KEY_REQUIRED';
          } else {
            summaryError = error?.message || 'Unable to generate summary';
          }
          summary = 'Summary not available.';
          console.error('[TaskService] Summary generation failed:', error);
        }
      }

      return {
        tasks,
        total,
        nextOffset: tasks.length === limit ? offset + limit : undefined,
        summary,
        summaryError,
      };
    } catch (error) {
      console.error('[TaskService] Error listing tasks:', error);
      throw error;
    }
  }

  /**
   * Generate summary for a dataset (separate endpoint for async loading)
   */
  async generateSummary(
    dataset: string,
    limit: number = 50,
    offset: number = 0,
    apiKey?: string
  ): Promise<{ summary: string; summaryError?: string }> {
    try {
      console.log(`[TaskService] Generating summary for dataset: ${dataset}`);

      // Fetch tasks for summary generation
      const { tasks } = await this.fetchPagedTasks(dataset, limit, offset);

      if (!this.taskSummaryHelper) {
        return {
          summary: 'Summary not available.',
          summaryError: 'Summary helper not configured',
        };
      }

      try {
        const summary = await this.taskSummaryHelper.generateDatasetSummary(dataset, tasks, {
          model: process.env.TASK_SUMMARY_MODEL || "gpt-5-mini",
          apiKey,
        });

        return { summary };
      } catch (error: any) {
        let summaryError: string;
        if (error?.message === 'OPENAI_API_KEY_REQUIRED') {
          summaryError = 'OPENAI_API_KEY_REQUIRED';
        } else {
          summaryError = error?.message || 'Unable to generate summary';
        }

        console.error('[TaskService] Summary generation failed:', error);
        return {
          summary: 'Summary not available.',
          summaryError,
        };
      }
    } catch (error) {
      console.error('[TaskService] Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific dataset or all datasets
   */
  clearCache(dataset?: string): void {
    if (dataset) {
      this.taskCache.delete(dataset);
      console.log('[TaskService] Cache cleared for dataset:', dataset);
    } else {
      this.taskCache.clear();
      console.log('[TaskService] All task caches cleared');
    }
  }

  /**
   * Private: Fetch a single page of tasks from HuggingFace dataset
   */
  private async fetchPagedTasks(
    dataset: string,
    limit: number,
    offset: number,
  ): Promise<{ tasks: TaskDetail[]; totalRows?: number }> {
    const tasks: TaskDetail[] = [];
    let totalRows: number | undefined;

    try {
      console.log(`[TaskService] Fetching single page at offset ${offset}, limit ${limit}`);
      const response = await this.hfService.getDatasetRows(dataset, 'default', 'train', offset, limit);
      totalRows = response.num_rows_total;

      if (!response.rows || response.rows.length === 0) {
        console.log('[TaskService] No rows found');
        return { tasks, totalRows };
      }

      // Process each row
      for (const hfRow of response.rows) {
        const rowData = hfRow.row;

        // Extract path and task_binary from row
        const path = rowData.path as string;
        const taskBinary = rowData.task_binary;

        if (!path || !taskBinary) {
          console.warn('[TaskService] Skipping row without path or task_binary');
          continue;
        }

        try {
          // Extract tar.gz and get files
          const files = await this.extractTarGz(taskBinary);
          tasks.push({ path, files });
        } catch (error) {
          console.error(`[TaskService] Failed to extract task at path ${path}:`, error);
          console.error(`[TaskService] Error details:`, error instanceof Error ? error.message : error);
          // Continue with other tasks even if one fails
        }
      }

      console.log(`[TaskService] Successfully processed ${tasks.length} tasks from this page`);
      return { tasks, totalRows };
    } catch (error) {
      console.error('[TaskService] Error fetching paged tasks:', error);
      if (error instanceof Error) {
        console.error('[TaskService] Error stack:', error.stack);
        throw new Error(`Failed to fetch tasks from dataset ${dataset}: ${error.message}`);
      }
      throw new Error(`Failed to fetch tasks from dataset ${dataset}`);
    }
  }

  /**
   * DEPRECATED: Fetch all tasks - causes rate limits, use fetchPagedTasks instead
   */
  private async fetchAllTasks(dataset: string): Promise<TaskDetail[]> {
    const tasks: TaskDetail[] = [];
    let offset = 0;
    const pageSize = 100;
    let totalFetched = 0;

    try {
      while (totalFetched < 10000) { // Safety limit
        console.log(`[TaskService] Fetching batch at offset ${offset}...`);
        const response = await this.hfService.getDatasetRows(dataset, 'default', 'train', offset, pageSize);

        if (!response.rows || response.rows.length === 0) {
          console.log('[TaskService] No more rows to fetch');
          break;
        }

        // Process each row
        for (const hfRow of response.rows) {
          const rowData = hfRow.row;

          // Extract path and task_binary from row
          const path = rowData.path as string;
          const taskBinary = rowData.task_binary;

          if (!path || !taskBinary) {
            console.warn('[TaskService] Skipping row without path or task_binary');
            continue;
          }

          try {
            // Extract tar.gz and get files
            const files = await this.extractTarGz(taskBinary);
            tasks.push({ path, files });
          } catch (error) {
            console.error(`[TaskService] Failed to extract task at path ${path}:`, error);
            console.error(`[TaskService] Error details:`, error instanceof Error ? error.message : error);
            // Continue with other tasks even if one fails
          }
        }

        totalFetched += response.rows.length;
        console.log(`[TaskService] Fetched ${response.rows.length} rows, total so far: ${totalFetched}`);

        // Check if there are more rows
        if (totalFetched >= response.num_rows_total) {
          console.log(`[TaskService] Reached end of dataset (${response.num_rows_total} total rows)`);
          break;
        }

        offset += pageSize;
      }

      console.log(`[TaskService] Successfully fetched ${tasks.length} total tasks`);
      return tasks;
    } catch (error) {
      console.error('[TaskService] Fatal error fetching all tasks:', error);
      if (error instanceof Error) {
        console.error('[TaskService] Error stack:', error.stack);
        throw new Error(`Failed to fetch tasks from dataset ${dataset}: ${error.message}`);
      }
      throw new Error(`Failed to fetch tasks from dataset ${dataset}`);
    }
  }

  /**
   * Extract tar.gz archive and return list of files with content
   */
  private async extractTarGz(binaryData: any): Promise<ExtractedFile[]> {
    const files: ExtractedFile[] = [];

    try {
      // Convert various data formats to buffer
      let buffer: Buffer;

      if (Buffer.isBuffer(binaryData)) {
        buffer = binaryData;
      } else if (typeof binaryData === 'string') {
        // Try base64 first, then utf8
        try {
          buffer = Buffer.from(binaryData, 'base64');
        } catch {
          buffer = Buffer.from(binaryData, 'utf8');
        }
      } else if (binaryData instanceof Uint8Array) {
        buffer = Buffer.from(binaryData);
      } else if (Array.isArray(binaryData)) {
        buffer = Buffer.from(binaryData);
      } else if (typeof binaryData === 'object' && binaryData.data) {
        // Handle { type: 'Buffer', data: [...] } format
        buffer = Buffer.from(binaryData.data);
      } else {
        throw new Error(`Unsupported binary data type: ${typeof binaryData}`);
      }

      console.log(`[TaskService] Extracting tar.gz, buffer size: ${buffer.length} bytes`);

      // Check if it's gzip compressed
      const isGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
      console.log(`[TaskService] Is gzip: ${isGzip}`);

      const stream = Readable.from(buffer);

      await new Promise<void>((resolve, reject) => {
        const tarStream = tar.t({
          onentry: (entry) => {
            const chunks: Buffer[] = [];

            entry.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });

            entry.on('end', () => {
              const filePath = entry.path;
              const size = entry.size;
              const isText = this.isTextFile(filePath);

              let content: string | undefined;
              if (isText && size < 1000000) { // Limit to 1MB for text files
                try {
                  content = Buffer.concat(chunks).toString('utf-8');
                } catch (error) {
                  console.warn(`[TaskService] Failed to decode text file ${filePath}:`, error);
                  content = undefined;
                }
              }

              files.push({
                path: filePath,
                size,
                isText,
                content,
              });
            });
          },
        });

        tarStream.on('finish', () => {
          console.log(`[TaskService] Tar extraction finished, extracted ${files.length} files`);
          resolve();
        });

        tarStream.on('error', (err) => {
          console.error(`[TaskService] Tar extraction error:`, err);
          reject(err);
        });

        stream.pipe(tarStream);
      });

      return files;
    } catch (error) {
      console.error('[TaskService] Error extracting tar.gz:', error);
      throw new Error('Failed to extract tar.gz archive');
    }
  }

  /**
   * Determine if a file is text-based by its extension
   */
  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.md', '.txt', '.py', '.js', '.ts', '.tsx', '.jsx',
      '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
      '.sh', '.bash', '.zsh', '.fish',
      '.html', '.css', '.scss', '.sass', '.less',
      '.xml', '.svg',
      '.c', '.cpp', '.h', '.hpp', '.java', '.go', '.rs', '.rb', '.php',
      '.sql', '.r', '.R', '.m', '.mat',
      '.log', '.csv', '.tsv',
      '.gitignore', '.dockerignore', '.env',
      'Dockerfile', 'Makefile', 'README', 'LICENSE',
    ];

    const lowerPath = filePath.toLowerCase();

    // Check extensions
    if (textExtensions.some(ext => lowerPath.endsWith(ext))) {
      return true;
    }

    // Check special files without extensions
    const baseName = filePath.split('/').pop() || '';
    const specialFiles = ['Dockerfile', 'Makefile', 'README', 'LICENSE'];
    if (specialFiles.some(name => baseName === name || baseName.startsWith(name))) {
      return true;
    }

    return false;
  }
}
