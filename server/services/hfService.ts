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
    try {
      const response = await axios.get(`${this.apiUrl}/rows`, {
        params: {
          dataset,
          config,
          split,
          offset,
          length,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching dataset rows:', error);
      throw new Error('Failed to fetch dataset rows');
    }
  }

  async extractTarFromUrl(tarUrl: string): Promise<TarFileContent[]> {
    try {
      const response = await axios.get(tarUrl, {
        responseType: 'arraybuffer',
      });

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

      return files;
    } catch (error) {
      console.error('Error extracting tar:', error);
      throw new Error('Failed to extract tar file');
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

      const contentsForAnalysis = tarContents
        .filter(f => f.content)
        .map(f => `File: ${f.path}\nType: ${f.type}\nSize: ${f.size}\n\nContent:\n${f.content?.substring(0, 5000)}`)
        .join('\n\n---\n\n');

      const prompt = `You are an expert test analyzer. Analyze the following extracted tar file contents from a test run and count how many times each type of error occurred.

${contentsForAnalysis}

IMPORTANT: Count how many times each error category occurs. Return a count for ALL categories below, even if the count is 0.

Error categories:
1. functionCallError - Agent called a function incorrectly
2. malformedJson - Agent produced malformed JSON
3. factualComputationalError - Agent made a factual or computational error
4. exceededContextWindow - Agent exceeded context window
5. misunderstoodInstructions - Agent misunderstood task instructions or that it was a terminal agent
6. shellToolMisuse - Agent misused a shell tool
7. noTaskConfirmation - Agent did not confirm task completion when prompted
8. exhaustedDiskSpace - Agent exhausted disk space
9. hallucinatedSolutions - Agent hallucinated solutions or attempted to cheat (this includes mocking files that needed to be real or pretending to have solved the problem)
10. systemFailure - Non-agent system failure (exhausted memory, exhausted disk space, bad environment, external kill signal, et cetera)
11. otherAgentError - Any other agent-caused error

Provide your analysis in JSON format with the following structure:
{
  "runDetails": {
    "config": <parsed config.json if available, otherwise null>,
    "result": <parsed result.json if available, otherwise null>,
    "exception": <exception.txt content if available, otherwise null>
  },
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
  "summary": "Brief summary of findings"
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
      
      const result = {
        runDetails: rawResult.runDetails || {},
        errorCounts,
        summary: rawResult.summary || 'No summary available',
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
