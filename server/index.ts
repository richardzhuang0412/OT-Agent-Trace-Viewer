import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Enable response compression for large payloads
app.use(compression());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Configure session middleware for API key storage
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-' + Math.random().toString(36),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log('Starting application...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Port:', process.env.PORT || '5000');
    
    // Log optional secrets status (don't fail if missing)
    const optionalSecrets = ['OPENAI_API_KEY', 'SESSION_SECRET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
    const missingOptional = optionalSecrets.filter(secret => !process.env[secret]);
    if (missingOptional.length > 0) {
      console.info('Missing optional secrets:', missingOptional.join(', '));
      console.info('Some features may require configuration. OPENAI_API_KEY can be configured per-session via Settings.');
    }

    console.log('Registering routes...');
    const server = await registerRoutes(app);
    console.log('Routes registered successfully');

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error('Error handler caught:', err);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log('Setting up Vite for development...');
      await setupVite(app, server);
      console.log('Vite setup complete');
    } else {
      console.log('Setting up static file serving for production...');
      serveStatic(app);
      console.log('Static file serving configured');
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    console.log(`Starting server on 0.0.0.0:${port}...`);
    // Note: reusePort is not supported on macOS, so we only enable it on Linux
    const listenOptions: any = {
      port,
      host: "0.0.0.0",
    };

    // Only enable reusePort on Linux (not supported on macOS/Darwin)
    if (process.platform === 'linux') {
      listenOptions.reusePort = true;
    }

    server.listen(listenOptions, () => {
      log(`serving on port ${port}`);
      console.log(`✓ Server successfully started and listening on 0.0.0.0:${port}`);
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      console.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Fatal error during startup:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    process.exit(1);
  }
})();
