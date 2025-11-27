import type { Express } from "express";
import { createServer, type Server } from "http";
import { S3Service } from "./services/s3Service";
import { HfService } from "./services/hfService";
import { TraceService } from "./services/traceService";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const s3Service = new S3Service();
  const hfService = new HfService();
  const traceService = new TraceService();

  // Health check endpoint for deployment verification
  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    });
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

  // HuggingFace dataset routes
  app.get("/api/hf/datasets", async (req, res) => {
    try {
      const { author } = req.query;
      const datasets = await hfService.listDatasets(author as string || 'mlfoundations-dev');
      res.json(datasets);
    } catch (error) {
      console.error("Error fetching HuggingFace datasets:", error);
      res.status(500).json({ error: "Failed to fetch datasets" });
    }
  });

  app.get("/api/hf/rows", async (req, res) => {
    try {
      const { dataset, config, split, offset, length } = req.query;
      
      console.log('[Route /api/hf/rows] Received request:', { dataset, config, split, offset, length });
      
      if (!dataset || typeof dataset !== 'string') {
        console.error('[Route /api/hf/rows] Missing or invalid dataset parameter');
        return res.status(400).json({ error: "Missing dataset parameter" });
      }

      const rows = await hfService.getDatasetRows(
        dataset,
        config as string || 'default',
        split as string || 'train',
        parseInt(offset as string) || 0,
        parseInt(length as string) || 100  // HuggingFace API max is 100
      );
      
      console.log('[Route /api/hf/rows] Successfully fetched', rows.rows?.length || 0, 'rows');
      
      // Check response size
      const responseSize = JSON.stringify(rows).length;
      console.log('[Route /api/hf/rows] Response size:', responseSize, 'bytes (', (responseSize / 1024 / 1024).toFixed(2), 'MB)');
      
      if (responseSize > 5 * 1024 * 1024) {
        console.warn('[Route /api/hf/rows] WARNING: Response is larger than 5MB, this might cause issues');
      }
      
      console.log('[Route /api/hf/rows] Sending response to client...');
      res.json(rows);
      console.log('[Route /api/hf/rows] Response sent successfully');
    } catch (error: any) {
      console.error('[Route /api/hf/rows] ===== ERROR CAUGHT IN ROUTE =====');
      console.error('[Route /api/hf/rows] Error name:', error.name);
      console.error('[Route /api/hf/rows] Error message:', error.message);
      console.error('[Route /api/hf/rows] Error statusCode:', error.statusCode);
      console.error('[Route /api/hf/rows] Error stack:', error.stack);
      
      const statusCode = error.statusCode || 500;
      const errorMessage = error.message || "Failed to fetch dataset rows";
      
      console.error('[Route /api/hf/rows] Returning error to client:', { statusCode, errorMessage });
      
      res.status(statusCode).json({ 
        error: errorMessage,
        ...(error.responseData && { responseData: error.responseData }),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    }
  });

  app.post("/api/hf/extract-tar", async (req, res) => {
    try {
      const { tarUrl, tarBase64 } = req.body;
      
      let files;
      if (tarUrl) {
        files = await hfService.extractTarFromUrl(tarUrl);
      } else if (tarBase64) {
        files = await hfService.extractTarFromBase64(tarBase64);
      } else {
        return res.status(400).json({ error: "Missing tarUrl or tarBase64 parameter" });
      }
      
      res.json({ files });
    } catch (error) {
      console.error("Error extracting tar:", error);
      res.status(500).json({ error: "Failed to extract tar file" });
    }
  });

  app.post("/api/hf/judge", async (req, res) => {
    try {
      const { files } = req.body;
      
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ error: "Missing files parameter" });
      }
      
      const result = await hfService.runLmJudge(files);
      res.json(result);
    } catch (error: any) {
      console.error("Error running LM judge:", error);
      
      // Handle OpenAI quota errors specifically
      if (error.status === 429 || error.code === 'insufficient_quota') {
        return res.status(429).json({ 
          error: "OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits.",
          details: "You have exceeded your current OpenAI API quota."
        });
      }
      
      // Handle other OpenAI API errors
      if (error.status && error.message) {
        return res.status(error.status).json({ 
          error: error.message 
        });
      }
      
      res.status(500).json({ error: "Failed to run LM judge analysis" });
    }
  });

  app.post("/api/hf/judge-all-rows", async (req, res) => {
    try {
      const { rows } = req.body;
      
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ error: "Missing rows parameter" });
      }
      
      console.log(`[Route /api/hf/judge-all-rows] Running bulk judge on ${rows.length} rows`);
      
      const result = await hfService.runBulkLmJudge(rows);
      res.json(result);
    } catch (error: any) {
      console.error("Error running bulk LM judge:", error);
      
      // Handle OpenAI quota errors specifically
      if (error.status === 429 || error.code === 'insufficient_quota') {
        return res.status(429).json({ 
          error: "OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits.",
          details: "You have exceeded your current OpenAI API quota."
        });
      }
      
      // Handle other OpenAI API errors
      if (error.status && error.message) {
        return res.status(error.status).json({ 
          error: error.message 
        });
      }
      
      res.status(500).json({ error: "Failed to run bulk LM judge analysis" });
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

  const httpServer = createServer(app);
  return httpServer;
}
