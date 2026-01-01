import axios from 'axios';
import * as tar from 'tar';
import { Readable } from 'stream';
import type { HfDataset, HfDatasetRowsResponse, TarFileContent, LmJudgeResult } from '@shared/schema';
import { OpenAIHelper } from './openAIHelper';
import { JudgeHelper } from './judgeHelper';
import { SummaryHelper } from './summaryHelper';

export class HfService {
  private baseUrl = 'https://huggingface.co';
  private apiUrl = 'https://datasets-server.huggingface.co';

  constructor(
    private openAIHelper = new OpenAIHelper(),
    private judgeHelper = new JudgeHelper(openAIHelper),
    private summaryHelper = new SummaryHelper(openAIHelper),
  ) {}

  async listDatasets(author: string = 'mlfoundations-dev'): Promise<HfDataset[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/datasets`, {
        params: {
          author,
          limit: 100,
          full: true,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching HuggingFace datasets:', error);
      throw new Error('Failed to fetch datasets from HuggingFace');
    }
  }

  async getDatasetRows(
    dataset: string,
    config: string = 'default',
    split: string = 'train',
    offset: number = 0,
    length: number = 100
  ): Promise<HfDatasetRowsResponse> {
    const startTime = Date.now();
    try {
      console.log('[HF Service] ===== Starting HuggingFace API Request =====');
      console.log('[HF Service] Dataset:', dataset);
      console.log('[HF Service] Config:', config, 'Split:', split, 'Offset:', offset, 'Length:', length);
      console.log('[HF Service] API URL:', this.apiUrl);
      console.log('[HF Service] Full request URL:', `${this.apiUrl}/rows?dataset=${dataset}&config=${config}&split=${split}&offset=${offset}&length=${length}`);
      
      const response = await axios.get(`${this.apiUrl}/rows`, {
        params: {
          dataset,
          config,
          split,
          offset,
          length,
        },
        timeout: 60000, // 60 second timeout
      });
      
      const duration = Date.now() - startTime;
      console.log(`[HF Service] ✓ SUCCESS - Fetched ${response.data.rows?.length || 0} rows in ${duration}ms`);
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[HF Service] ✗ FAILED after', duration, 'ms');
      console.error('[HF Service] Error type:', error.code || 'UNKNOWN');
      console.error('[HF Service] Error message:', error.message);
      
      if (error.response) {
        console.error('[HF Service] Got HTTP response with error');
        console.error('[HF Service] Response status:', error.response.status);
        console.error('[HF Service] Response statusText:', error.response.statusText);
        console.error('[HF Service] Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('[HF Service] Response headers:', JSON.stringify(error.response.headers, null, 2));
        
        const hfError: any = new Error(`HuggingFace API error: ${error.response.status} ${error.response.statusText}`);
        hfError.statusCode = error.response.status;
        hfError.responseData = error.response.data;
        throw hfError;
      } else if (error.request) {
        console.error('[HF Service] No response received from server');
        console.error('[HF Service] This usually means a network/timeout issue');
        console.error('[HF Service] Error code:', error.code);
        console.error('[HF Service] Error stack:', error.stack);
        
        const hfError: any = new Error(`No response from HuggingFace server (${error.code || 'NETWORK_ERROR'})`);
        hfError.statusCode = 503;
        throw hfError;
      } else {
        console.error('[HF Service] Request setup error');
        console.error('[HF Service] Full error:', error);
        throw error;
      }
    }
  }

  async extractTarFromUrl(tarUrl: string): Promise<TarFileContent[]> {
    try {
      console.log('Extracting tar from URL:', tarUrl);
      
      const response = await axios.get(tarUrl, {
        responseType: 'arraybuffer',
        timeout: 120000, // 2 minute timeout for large tar files
        maxContentLength: 100 * 1024 * 1024, // 100MB max
      });

      console.log('Tar file downloaded, size:', response.data.byteLength, 'bytes');

      const files: TarFileContent[] = [];
      const buffer = Buffer.from(response.data);
      const stream = Readable.from(buffer);

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(tar.t({
            onentry: (entry) => {
              const chunks: Buffer[] = [];
              
              entry.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
              });

              entry.on('end', () => {
                const content = Buffer.concat(chunks).toString('utf-8');
                files.push({
                  path: entry.path,
                  type: entry.type,
                  size: entry.size,
                  content: content.length < 100000 ? content : undefined,
                });
              });
            },
          }))
          .on('finish', resolve)
          .on('error', reject);
      });

      console.log('Tar extraction complete, extracted', files.length, 'files');
      return files;
    } catch (error: any) {
      console.error('Error extracting tar from URL:', tarUrl);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        
        const tarError: any = new Error(`Failed to download tar file from URL`);
        tarError.statusCode = error.response.status;
        throw tarError;
      } else if (error.request) {
        console.error('No response received:', error.message);
        const tarError: any = new Error(`No response from tar file server`);
        tarError.statusCode = 503;
        throw tarError;
      } else {
        console.error('Error:', error.message);
        throw error;
      }
    }
  }

  async extractTarFromBase64(base64Data: string): Promise<TarFileContent[]> {
    try {
      const files: TarFileContent[] = [];
      const buffer = Buffer.from(base64Data, 'base64');

      const stream = Readable.from(buffer);
      
      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(tar.t({
            onentry: async (entry) => {
              const chunks: Buffer[] = [];
              
              entry.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
              });

              entry.on('end', () => {
                const content = Buffer.concat(chunks).toString('utf-8');
                files.push({
                  path: entry.path,
                  type: entry.type,
                  size: entry.size,
                  content: content.length < 100000 ? content : undefined,
                });
              });
            },
          }))
          .on('finish', resolve)
          .on('error', reject);
      });

      return files;
    } catch (error) {
      console.error('Error extracting tar from base64:', error);
      throw new Error('Failed to extract tar from base64');
    }
  }

  async runLmJudge(tarContents: TarFileContent[]): Promise<LmJudgeResult> {
    try {
      return await this.judgeHelper.analyzeTarContents(tarContents);
    } catch (error) {
      console.error('Error running LM judge:', error);
      throw new Error('Failed to run LM judge analysis');
    }
  }

  async runBulkLmJudge(rows: any[]): Promise<LmJudgeResult> {
    try {
      const processedRows = rows.map((row, idx) => ({
        row_idx: row.row_idx ?? idx,
        row: extractRelevantData(row.row),
      }));

      return await this.judgeHelper.analyzeRows(processedRows);
    } catch (error) {
      console.error('Error running bulk LM judge:', error);
      throw new Error('Failed to run bulk LM judge analysis');
    }
  }

  async summarizeContent(content: string) {
    return this.summaryHelper.summarize(content);
  }
}

function extractRelevantData(rowData: any): any {
  if (Array.isArray(rowData)) {
    return rowData.slice(0, 10).map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? truncate(msg.content, 2000)
        : msg.content,
    }));
  }

  if (typeof rowData === 'object' && rowData !== null) {
    const extracted: any = {};
    const priorityFields = ['conversation', 'messages', 'error', 'exception', 'result', 'status', 'task', 'agent', 'model'];

    for (const key of priorityFields) {
      if (key in rowData) {
        extracted[key] = extractRelevantData(rowData[key]);
      }
    }

    if (Object.keys(extracted).length === 0) {
      for (const [key, value] of Object.entries(rowData)) {
        if (typeof value === 'string') {
          extracted[key] = truncate(value, 500);
        } else if (Array.isArray(value)) {
          extracted[key] = value.slice(0, 5);
        } else if (typeof value === 'object' && value !== null) {
          extracted[key] = '[object]';
        } else {
          extracted[key] = value;
        }
      }
    }

    return extracted;
  }

  return rowData;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.substring(0, maxLength)}...[truncated]` : value;
}
