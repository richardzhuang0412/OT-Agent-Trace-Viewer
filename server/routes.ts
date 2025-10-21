import type { Express } from "express";
import { createServer, type Server } from "http";
import { S3Service } from "./services/s3Service";
import { HfService } from "./services/hfService";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const s3Service = new S3Service();
  const hfService = new HfService();

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
      
      if (!dataset || typeof dataset !== 'string') {
        return res.status(400).json({ error: "Missing dataset parameter" });
      }

      const rows = await hfService.getDatasetRows(
        dataset,
        config as string || 'default',
        split as string || 'train',
        parseInt(offset as string) || 0,
        parseInt(length as string) || 100
      );
      
      res.json(rows);
    } catch (error) {
      console.error("Error fetching dataset rows:", error);
      res.status(500).json({ error: "Failed to fetch dataset rows" });
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
    } catch (error) {
      console.error("Error running LM judge:", error);
      res.status(500).json({ error: "Failed to run LM judge analysis" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
