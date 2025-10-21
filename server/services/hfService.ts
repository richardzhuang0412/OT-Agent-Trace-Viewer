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

      const contentsForAnalysis = tarContents
        .filter(f => f.content)
        .map(f => `File: ${f.path}\nType: ${f.type}\nSize: ${f.size}\n\nContent:\n${f.content?.substring(0, 5000)}`)
        .join('\n\n---\n\n');

      const prompt = `You are an expert test analyzer. Analyze the following extracted tar file contents from a test run and identify what failed.

${contentsForAnalysis}

IMPORTANT: For each type of error or issue you identify, count how many times it occurs across all the files. Group similar errors together and provide the total count.

Classify each error into one of the following categories:
- Agent called a function incorrectly
- Agent produced malformed JSON
- Agent made a factual or computational error
- Agent exceeded context window
- Agent misunderstood task instructions or that it was a terminal agent
- Agent misused a shell tool
- Agent did not confirm task completion when prompted
- Agent exhausted disk space
- Agent hallucinated solutions or attempted to cheat (this includes mocking files that needed to be real or pretending to have solved the problem)
- Non-agent system failure (exhausted memory, exhausted disk space, bad environment, external kill signal, et cetera)
- Any other agent-caused error

Provide your analysis in JSON format with the following structure:
{
  "analysis": "Overall analysis of the test run",
  "failures": [
    {
      "issue": "One of the error categories listed above",
      "severity": "low|medium|high|critical",
      "explanation": "Detailed explanation of what went wrong",
      "count": <number of times this error occurred>
    }
  ],
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
      
      // Ensure all failures have a count field, defaulting to 1 if missing
      const failures = (rawResult.failures || []).map((failure: any) => ({
        issue: failure.issue || 'Unknown issue',
        severity: ['low', 'medium', 'high', 'critical'].includes(failure.severity) 
          ? failure.severity 
          : 'medium',
        explanation: failure.explanation || 'No explanation provided',
        count: typeof failure.count === 'number' && failure.count > 0 ? failure.count : 1,
      }));
      
      const result = {
        analysis: rawResult.analysis || 'No analysis available',
        failures,
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
