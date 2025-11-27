# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack React + Express.js application for viewing and analyzing HuggingFace datasets and their trace data. The application provides dual functionality:

1. **Terminal Bench Viewer**: Browse and analyze terminal benchmarking data from AWS S3 organized by date, task, and AI model
2. **Dataset Trace Viewer**: View HuggingFace dataset rows with error analysis and task quality assessment using LM Judge

## Development Commands

```bash
# Development - runs with hot reload
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Start production server
npm start

# Database migration (not currently used)
npm run db:push
```

## Architecture Overview

### Key Technology Stack

**Frontend:**
- React 18 with TypeScript and Vite
- UI: shadcn/ui components on Radix UI primitives
- Styling: Tailwind CSS with custom dark theme
- State: TanStack Query (React Query) for server state
- Routing: Wouter for lightweight client-side routing
- Terminal playback: Asciinema player

**Backend:**
- Express.js with TypeScript (ES modules)
- AWS S3 API integration
- HuggingFace API integration
- OpenAI API integration for LM Judge evaluations

### Directory Structure

```
├── client/src/
│   ├── pages/              # Page components (Home, TaskPage, DatasetsPage, DatasetRowsPage)
│   ├── components/
│   │   ├── ui/            # Shadcn/ui primitive components (auto-generated)
│   │   ├── MainContent.tsx
│   │   ├── NavigationSidebar.tsx
│   │   ├── JsonTableViewer.tsx
│   │   ├── TerminalViewer.tsx
│   │   └── TaskQualityAssessment.tsx
│   ├── hooks/             # useS3Data, useS3Hierarchy, useTaskRun, use-mobile, use-toast
│   ├── lib/               # utilities: utils.ts, queryClient.ts
│   └── App.tsx            # Router setup with Wouter
├── server/
│   ├── index.ts           # Express app setup, middleware, server initialization
│   ├── routes.ts          # API endpoint definitions
│   ├── storage.ts         # (Present but minimal usage)
│   ├── vite.ts            # Dev server integration and static file serving
│   └── services/
│       ├── s3Service.ts    # S3 hierarchy navigation and data fetching
│       └── hfService.ts    # HuggingFace API integration, dataset rows, LM Judge
├── shared/
│   └── schema.ts          # Zod schemas for type safety (S3, HF, task data)
```

### Data Flow Architecture

**S3 Hierarchy Browsing:**
1. Client queries `/api/hierarchy` → S3Service traverses S3 structure
2. S3 path structure: `tb-2.0-audit/<date>/<task-id>/<model-name>/`
3. Returns hierarchical data (dates → tasks → models)
4. Client fetches specific task run with `/api/task-run/:date/:taskId/:modelName`

**HuggingFace Dataset Browsing:**
1. Client queries `/api/datasets` → HfService lists datasets from mlfoundations-dev author
2. Client queries `/api/dataset-rows/:dataset/:config/:split` → HfService fetches rows
3. Optional: LM Judge analysis for dataset rows using OpenAI API
4. Handles tar.gz file extraction for dataset contents

**Type Safety:**
- All external data validated with Zod schemas (shared/schema.ts)
- Path aliases: `@/*` → client/src, `@shared/*` → shared/

### Key Components & Data Models

**TaskRun** (shared/schema.ts): Represents a single task execution
- date, taskId, modelName, taskYaml, resultsJson, agentCast (terminal recording), files

**HfDataset**: Dataset metadata from HuggingFace
- name, id, author, description, etc.

**HfDatasetRowsResponse**: Paginated dataset rows from HF API
- rows: array of row data
- truncated: boolean indicating more data exists

**S3Hierarchy**: Nested structure from S3 traversal
- dates[] → tasks[] → models[]

### Important Implementation Details

1. **S3-First Data Model**: Application reads directly from S3 without traditional database. Database is configured but not used.

2. **Error Handling in Routes**: Routes return structured error responses and log to console for debugging.

3. **Request Logging Middleware**: All `/api/*` requests logged with method, path, status, duration, and response summary.

4. **CORS & Compression**: Response compression enabled for large payloads (especially Asciinema files).

5. **Query Client**: TanStack Query configured in client/src/lib/queryClient.ts with default stale times of 5-10 minutes.

6. **Routes**:
   - `/api/health` - deployment verification
   - `/api/hierarchy` - S3 data structure
   - `/api/task-run/:date/:taskId/:modelName` - specific task data
   - `/api/datasets` - list HF datasets
   - `/api/dataset-rows/:dataset/:config/:split` - paginated dataset rows
   - `/api/lm-judge` - evaluate rows with OpenAI (POST)
   - `/api/search` - search tasks (if implemented)

7. **Page Routes** (via Wouter):
   - `/` → redirects to `/datasets`
   - `/task/:date/:taskId` - TaskPage (browse models for task)
   - `/datasets/:datasetId` - DatasetRowsPage (view rows, assessment)
   - `/datasets` - DatasetsPage (list all datasets)
   - `/s3` - Home (S3 hierarchy viewer)

## API Integration Points

**AWS S3**: Read-only access to benchmark data
- Bucket: `t-bench-mam`
- Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

**HuggingFace API**: Dataset discovery and row fetching
- Endpoints: https://huggingface.co/api/datasets, https://datasets-server.huggingface.co/rows
- No authentication required for public datasets

**OpenAI API**: LM Judge evaluation
- Required for task quality assessment
- Requires: OPENAI_API_KEY

## Environment Variables

**Required:**
- `OPENAI_API_KEY` - for LM Judge

**Optional:**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` - for S3 access
- `SESSION_SECRET` - for sessions (if auth is added)
- `PORT` - server port (default: 5000)
- `NODE_ENV` - development or production

## Performance Considerations

- S3 list operations can be slow for large hierarchies; consider pagination if scaling
- Asciinema files can be large; compression middleware handles this
- React Query caching prevents redundant API calls
- Consider implementing database indexes if switching from S3-only model
