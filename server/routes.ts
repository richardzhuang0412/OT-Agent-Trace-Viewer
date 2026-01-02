import type { Express } from "express";
import { createServer, type Server } from "http";
import { S3Service } from "./services/s3Service";
import { TraceService } from "./services/traceService";
import { TaskService } from "./services/taskService";
import { OpenAIHelper } from "./services/openAIHelper";
import { SummaryHelper } from "./services/summaryHelper";
import { JudgeHelper } from "./services/judgeHelper";
import { TaskSummaryHelper } from "./services/taskSummaryHelper";
import { HfService } from "./services/hfService";

export async function registerRoutes(app: Express): Promise<Server> {
  const s3Service = new S3Service();
  const openAIHelper = new OpenAIHelper();
  const summaryHelper = new SummaryHelper(openAIHelper);
  const judgeHelper = new JudgeHelper(openAIHelper);
  const hfService = new HfService(openAIHelper, judgeHelper, summaryHelper);
  const taskSummaryHelper = new TaskSummaryHelper(summaryHelper);

  const traceService = new TraceService(openAIHelper);
  const taskService = new TaskService(hfService, taskSummaryHelper);

  // Health check endpoint for deployment verification
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    });
  });

  // API Key Configuration Endpoints

  // Get OpenAI API key configuration status
  app.get("/api/config/openai-status", (req, res) => {
    const envKey = process.env.OPENAI_API_KEY;
    const sessionKey = req.session.openaiApiKey;

    if (envKey) {
      res.json({ hasKey: true, source: 'environment' });
    } else if (sessionKey) {
      res.json({ hasKey: true, source: 'session' });
    } else {
      res.json({ hasKey: false, source: 'none' });
    }
  });

  // Configure OpenAI API key for this session
  app.post("/api/config/openai-key", async (req, res) => {
    try {
      const { apiKey } = req.body;

      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'API key is required' });
      }

      // Validate API key format
      if (!apiKey.startsWith('sk-')) {
        return res.status(400).json({ error: 'Invalid API key format. OpenAI keys start with "sk-"' });
      }

      // Validate the key by making a test API call
      const isValid = await OpenAIHelper.validateKey(apiKey);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid API key. Please check and try again.' });
      }

      // Store in session
      req.session.openaiApiKey = apiKey;

      res.json({ success: true, source: 'session' });
    } catch (error) {
      console.error("Error configuring API key:", error);
      res.status(500).json({ error: "Failed to configure API key" });
    }
  });

  // Clear session API key
  app.delete("/api/config/openai-key", (req, res) => {
    delete req.session.openaiApiKey;
    res.json({ success: true });
  });

  // Get S3 hierarchy (dates -> tasks -> models)
  app.get("/api/hierarchy", async (req, res) => {
    try {
      const hierarchy = await s3Service.getHierarchy();
      res.json(hierarchy);
    } catch (error) {
      console.error("Error fetching hierarchy:", error);
      res.status(500).json({ error: "Failed to fetch S3 hierarchy" });
    }
  });

  // Get specific task run data
  app.get("/api/task-run/:date/:taskId/:modelName", async (req, res) => {
    try {
      const { date, taskId, modelName } = req.params;
      
      if (!date || !taskId || !modelName) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const taskRun = await s3Service.getTaskRun(date, taskId, modelName);
      
      if (!taskRun) {
        return res.status(404).json({ error: "Task run not found" });
      }

      res.json(taskRun);
    } catch (error) {
      console.error("Error fetching task run:", error);
      res.status(500).json({ error: "Failed to fetch task run data" });
    }
  });

  // Get task metadata (task.yaml) for task-level view
  app.get("/api/task-yaml/:date/:taskId", async (req, res) => {
    try {
      const { date, taskId } = req.params;
      
      if (!date || !taskId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const taskYaml = await s3Service.getTaskYaml(date, taskId);
      
      if (!taskYaml) {
        return res.status(404).json({ error: "Task metadata not found" });
      }

      res.json(taskYaml);
    } catch (error) {
      console.error("Error fetching task metadata:", error);
      res.status(500).json({ error: "Failed to fetch task metadata" });
    }
  });

  // Download specific file
  app.get("/api/download", async (req, res) => {
    try {
      const { path } = req.query;
      
      if (!path || typeof path !== "string") {
        return res.status(400).json({ error: "Missing file path" });
      }

      const content = await s3Service.downloadFile(path);
      
      // Set appropriate headers based on file type
      const filename = path.split('/').pop() || 'download';
      const extension = filename.split('.').pop()?.toLowerCase();
      
      let contentType = 'application/octet-stream';
      if (extension === 'json') contentType = 'application/json';
      else if (extension === 'yaml' || extension === 'yml') contentType = 'text/yaml';
      else if (extension === 'cast') contentType = 'application/json';
      else if (extension === 'check' || extension === 'debug') contentType = 'text/plain';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Search tasks
  app.get("/api/search", async (req, res) => {
    try {
      const { q, difficulty, model } = req.query;
      
      // For now, return the full hierarchy and let frontend filter
      // In a real implementation, you'd implement server-side filtering
      const hierarchy = await s3Service.getHierarchy();
      
      // Basic filtering logic
      let filteredHierarchy = hierarchy;
      
      if (difficulty && typeof difficulty === 'string') {
        // This would require fetching task.yaml files to filter by difficulty
        // For now, return unfiltered results
      }
      
      if (q && typeof q === 'string') {
        // Filter tasks and models by search query
        filteredHierarchy = {
          dates: hierarchy.dates.map(date => ({
            ...date,
            tasks: date.tasks.filter(task => 
              task.taskId.toLowerCase().includes(q.toLowerCase()) ||
              task.models.some(model => model.modelName.toLowerCase().includes(q.toLowerCase()))
            ).map(task => ({
              ...task,
              models: task.models.filter(model => 
                model.modelName.toLowerCase().includes(q.toLowerCase()) ||
                task.taskId.toLowerCase().includes(q.toLowerCase())
              )
            }))
          })).filter(date => date.tasks.length > 0)
        };
      }
      
      res.json(filteredHierarchy);
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });



  // ATIF Trace routes
  app.get("/api/traces/list", async (req, res) => {
    try {
      const { dataset, run_id, model, task, trial_name, limit, offset } = req.query;

      if (!dataset || typeof dataset !== 'string') {
        return res.status(400).json({ error: "Missing or invalid dataset parameter" });
      }

      const filters = {
        run_id: run_id as string | undefined,
        model: model as string | undefined,
        task: task as string | undefined,
        trial_name: trial_name as string | undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      };

      const result = await traceService.listTraces(dataset, filters);
      res.json(result);
    } catch (error) {
      console.error("Error listing traces:", error);
      res.status(500).json({ error: "Failed to fetch traces" });
    }
  });

  app.get("/api/traces/:dataset/:runId", async (req, res) => {
    try {
      const { dataset, runId } = req.params;

      if (!dataset || !runId) {
        return res.status(400).json({ error: "Missing dataset or runId parameter" });
      }

      const trace = await traceService.getTrace(dataset, runId);

      if (!trace) {
        return res.status(404).json({ error: "Trace not found" });
      }

      res.json(trace);
    } catch (error) {
      console.error("Error fetching trace:", error);
      res.status(500).json({ error: "Failed to fetch trace" });
    }
  });

  app.post("/api/traces/:dataset/:runId/judge", async (req, res) => {
    try {
      const { dataset, runId } = req.params;

      if (!dataset || !runId) {
        return res.status(400).json({ error: "Missing dataset or runId parameter" });
      }

      // Get API key from session or environment
      const apiKey = req.session.openaiApiKey || process.env.OPENAI_API_KEY;

      const result = await traceService.judgeTrace(dataset, runId, apiKey);
      res.json(result);
    } catch (error) {
      console.error("Error generating trace judgment:", error);

      // Handle missing API key error specifically
      if (error instanceof Error && error.message === 'OPENAI_API_KEY_REQUIRED') {
        return res.status(400).json({
          error: "OPENAI_API_KEY_REQUIRED",
          message: "OpenAI API key not configured. Please configure your API key in Settings."
        });
      }

      res.status(500).json({ error: "Failed to generate judgment" });
    }
  });

  app.get("/api/traces/:dataset/metadata", async (req, res) => {
    try {
      const { dataset } = req.params;

      if (!dataset) {
        return res.status(400).json({ error: "Missing dataset parameter" });
      }

      const metadata = await traceService.getMetadata(dataset);
      res.json(metadata);
    } catch (error) {
      console.error("Error fetching trace metadata:", error);
      res.status(500).json({ error: "Failed to fetch trace metadata" });
    }
  });

  app.post("/api/traces/:dataset/clear-cache", async (req, res) => {
    try {
      const { dataset } = req.params;

      if (!dataset) {
        return res.status(400).json({ error: "Missing dataset parameter" });
      }

      traceService.clearCache(dataset);
      res.json({ message: "Cache cleared successfully" });
    } catch (error) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  // Task dataset routes
  app.get("/api/tasks/list", async (req, res) => {
    try {
      const { dataset, limit, offset, skipSummary } = req.query;

      if (!dataset || typeof dataset !== 'string') {
        return res.status(400).json({ error: "Missing or invalid dataset parameter" });
      }

      const parsedLimit = limit ? parseInt(limit as string) : 50;
      const parsedOffset = offset ? parseInt(offset as string) : 0;
      const shouldSkipSummary = skipSummary === 'true';

      // Get API key from session or environment
      const apiKey = req.session.openaiApiKey || process.env.OPENAI_API_KEY;

      const result = await taskService.listTasks(dataset, parsedLimit, parsedOffset, {
        apiKey,
        skipSummary: shouldSkipSummary,
      });
      res.json(result);
    } catch (error) {
      console.error("Error listing tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/summary", async (req, res) => {
    try {
      const { dataset, limit, offset } = req.query;

      if (!dataset || typeof dataset !== 'string') {
        return res.status(400).json({ error: "Missing or invalid dataset parameter" });
      }

      const parsedLimit = limit ? parseInt(limit as string) : 50;
      const parsedOffset = offset ? parseInt(offset as string) : 0;

      // Get API key from session or environment
      const apiKey = req.session.openaiApiKey || process.env.OPENAI_API_KEY;

      const result = await taskService.generateSummary(dataset, parsedLimit, parsedOffset, apiKey);
      res.json(result);
    } catch (error) {
      console.error("Error generating task summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  app.post("/api/tasks/:dataset/clear-cache", async (req, res) => {
    try {
      const { dataset } = req.params;

      if (!dataset) {
        return res.status(400).json({ error: "Missing dataset parameter" });
      }

      taskService.clearCache(dataset);
      res.json({ message: "Cache cleared successfully" });
    } catch (error) {
      console.error("Error clearing task cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
