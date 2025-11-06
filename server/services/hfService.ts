import axios from 'axios';
import * as tar from 'tar';
import { Readable } from 'stream';
import OpenAI from 'openai';
import type { HfDataset, HfDatasetRowsResponse, TarFileContent, LmJudgeResult } from '@shared/schema';
import { lmJudgeResultSchema } from '@shared/schema';

export class HfService {
  private baseUrl = 'https://huggingface.co';
  private apiUrl = 'https://datasets-server.huggingface.co';

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
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Extract key files for run details
      const configFile = tarContents.find(f => f.path.endsWith('config.json'));
      const resultFile = tarContents.find(f => f.path.endsWith('result.json'));
      const exceptionFile = tarContents.find(f => f.path.endsWith('exception.txt'));

      let configData = null;
      let resultData = null;
      let exceptionData = null;

      if (configFile?.content) {
        try {
          configData = JSON.parse(configFile.content);
        } catch (e) {
          console.error('Failed to parse config.json:', e);
        }
      }

      if (resultFile?.content) {
        try {
          resultData = JSON.parse(resultFile.content);
        } catch (e) {
          console.error('Failed to parse result.json:', e);
        }
      }

      if (exceptionFile?.content) {
        exceptionData = exceptionFile.content;
      }

      const contentsForAnalysis = tarContents
        .filter(f => f.content)
        .map(f => `File: ${f.path}\nType: ${f.type}\nSize: ${f.size}\n\nContent:\n${f.content?.substring(0, 20000)}`)
        .join('\n\n---\n\n');

      const prompt = `You are an expert test analyzer. Analyze the following extracted tar file contents from a test run and identify ALL errors that occurred.

FILES CONTENT:
${contentsForAnalysis}

KEY FILES EXTRACTED:
- Config: ${configData ? JSON.stringify(configData, null, 2) : 'Not found'}
- Result: ${resultData ? JSON.stringify(resultData, null, 2) : 'Not found'}
- Exception: ${exceptionData || 'Not found'}

ANALYSIS STEPS:
1. Check result.json for the "resolved" field - if false, there was a failure
2. Read exception.txt for error messages, stack traces, and failure indicators
3. Search ALL files for error patterns like "Error:", "Exception:", "Failed", "Traceback", exit codes, etc.
4. Look for specific error indicators in logs and traces

ERROR DETECTION RULES (look for these specific patterns):

1. functionCallError - Count if you find:
   - "invalid arguments", "missing required parameter", "function not found"
   - TypeError, AttributeError related to function calls
   - Wrong number of arguments passed to functions

2. malformedJson - Count if you find:
   - "JSON parse error", "invalid JSON", "Expecting property name"
   - SyntaxError in JSON parsing
   - Unterminated strings or objects in JSON

3. factualComputationalError - Count if you find:
   - Incorrect calculations, wrong results, logic errors
   - Assertions failed, test failures, wrong outputs
   - Mathematical or logical mistakes

4. exceededContextWindow - Count if you find:
   - "context length exceeded", "maximum context", "token limit"
   - 400/413 errors related to input size

5. misunderstoodInstructions - Count if you find:
   - Agent did wrong task, ignored requirements
   - "task not completed", wrong interpretation
   - Agent stopped before finishing

6. shellToolMisuse - Count if you find:
   - Command not found, bash errors, invalid shell commands
   - "permission denied", syntax errors in bash
   - Incorrect use of shell tools

7. noTaskConfirmation - Count if you find:
   - Agent didn't respond when asked if task is complete
   - Missing confirmation messages

8. exhaustedDiskSpace - Count if you find:
   - "No space left on device", "disk full", "out of space"
   - ENOSPC errors

9. hallucinatedSolutions - Count if you find:
   - Mock/fake implementations instead of real solutions
   - Hardcoded test data, placeholder values
   - Comments like "TODO", "mock", "fake", "placeholder"
   - Agent claiming completion without actual work

10. systemFailure - Count if you find:
   - Out of memory, killed by system, segmentation fault
   - External process termination, timeout
   - Infrastructure/environment failures

11. otherAgentError - Count if you find:
   - Any other agent-related errors not covered above
   - Unexpected exceptions, runtime errors

IMPORTANT INSTRUCTIONS:
- Be thorough: scan exception.txt and ALL log files for error patterns
- Each occurrence of an error pattern = count of 1 (don't double-count the same error)
- If result.json shows resolved=false but you can't find specific errors, count as otherAgentError
- If you see multiple different errors, count each one
- Return 0 for categories where no errors are found

Provide your analysis in JSON format:
{
  "errorCounts": {
    "functionCallError": <count>,
    "malformedJson": <count>,
    "factualComputationalError": <count>,
    "exceededContextWindow": <count>,
    "misunderstoodInstructions": <count>,
    "shellToolMisuse": <count>,
    "noTaskConfirmation": <count>,
    "exhaustedDiskSpace": <count>,
    "hallucinatedSolutions": <count>,
    "systemFailure": <count>,
    "otherAgentError": <count>
  },
  "summary": "<Brief summary with dataset link and agent details from config.json>"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content: 'You are an expert test analyzer who identifies failures and issues in test runs. Respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4096,
      });

      const rawResult = JSON.parse(response.choices[0].message.content || '{}');
      
      // Log the raw LLM response for debugging
      console.log('Raw LLM Response:', JSON.stringify(rawResult, null, 2));
      
      // Ensure all error counts exist and are numbers, defaulting to 0 if missing
      const errorCounts = {
        functionCallError: typeof rawResult.errorCounts?.functionCallError === 'number' ? rawResult.errorCounts.functionCallError : 0,
        malformedJson: typeof rawResult.errorCounts?.malformedJson === 'number' ? rawResult.errorCounts.malformedJson : 0,
        factualComputationalError: typeof rawResult.errorCounts?.factualComputationalError === 'number' ? rawResult.errorCounts.factualComputationalError : 0,
        exceededContextWindow: typeof rawResult.errorCounts?.exceededContextWindow === 'number' ? rawResult.errorCounts.exceededContextWindow : 0,
        misunderstoodInstructions: typeof rawResult.errorCounts?.misunderstoodInstructions === 'number' ? rawResult.errorCounts.misunderstoodInstructions : 0,
        shellToolMisuse: typeof rawResult.errorCounts?.shellToolMisuse === 'number' ? rawResult.errorCounts.shellToolMisuse : 0,
        noTaskConfirmation: typeof rawResult.errorCounts?.noTaskConfirmation === 'number' ? rawResult.errorCounts.noTaskConfirmation : 0,
        exhaustedDiskSpace: typeof rawResult.errorCounts?.exhaustedDiskSpace === 'number' ? rawResult.errorCounts.exhaustedDiskSpace : 0,
        hallucinatedSolutions: typeof rawResult.errorCounts?.hallucinatedSolutions === 'number' ? rawResult.errorCounts.hallucinatedSolutions : 0,
        systemFailure: typeof rawResult.errorCounts?.systemFailure === 'number' ? rawResult.errorCounts.systemFailure : 0,
        otherAgentError: typeof rawResult.errorCounts?.otherAgentError === 'number' ? rawResult.errorCounts.otherAgentError : 0,
      };
      
      // Generate summary from config data if available - only include dataset link and agent details
      let summary = rawResult.summary || '';
      if (!summary && configData) {
        const config = configData as any;
        
        // Extract dataset link from nested structure
        const datasetLink = config.task?.dataset_link || config.task?.link || config.dataset_link || config.link || '';
        
        // Extract agent details from nested structure
        let agent = '';
        if (config.agent) {
          if (typeof config.agent === 'string') {
            agent = config.agent;
          } else if (config.agent.name) {
            agent = config.agent.name;
          } else if (config.agent.model) {
            agent = config.agent.model;
          }
        } else if (config.model) {
          agent = typeof config.model === 'string' ? config.model : config.model.name || '';
        }
        
        const parts = [];
        if (datasetLink) parts.push(`Dataset: ${datasetLink}`);
        if (agent) parts.push(`Agent: ${agent}`);
        
        summary = parts.length > 0 ? parts.join(' | ') : 'No summary available';
      }
      
      if (!summary) {
        summary = 'No summary available';
      }
      
      const result = {
        runDetails: null,
        errorCounts,
        summary,
      };

      // Validate the result against the schema
      const validated = lmJudgeResultSchema.parse(result);
      return validated;
    } catch (error) {
      console.error('Error running LM judge:', error);
      throw new Error('Failed to run LM judge analysis');
    }
  }
}
