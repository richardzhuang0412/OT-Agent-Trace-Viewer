import { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TraceFilterPanel } from '@/components/TraceFilterPanel';
import { TraceListViewer } from '@/components/TraceListViewer';
import { useTraceList, useClearTraceCache } from '@/hooks/useTraces';
import type { TraceFilterParams } from '@shared/schema';

export default function TraceBrowserPage() {
  const params = useParams<{ datasetId: string }>();
  const [, setLocation] = useLocation();
  const datasetId = params.datasetId ? decodeURIComponent(params.datasetId) : '';

  const [filters, setFilters] = useState<Partial<TraceFilterParams>>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Calculate offset from page and page size
  const offset = page * pageSize;

  // Fetch traces
  const {
    data: traceData,
    isLoading: isLoadingTraces,
    error: tracesError,
  } = useTraceList(datasetId, { ...filters, offset, limit: pageSize });

  // Cache clearing
  const { clearCache } = useClearTraceCache();

  const handleFilterChange = (newFilters: Partial<TraceFilterParams>) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page when filters change
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(0); // Reset to first page when page size changes
  };

  const handleRefresh = async () => {
    try {
      await clearCache(datasetId);
    } catch (error) {
      console.error('Error refreshing cache:', error);
    }
  };

  // Calculate total pages
  const totalPages = useMemo(() => {
    if (!traceData || traceData.total === 0) return 0;
    return Math.ceil(traceData.total / pageSize);
  }, [traceData, pageSize]);

  // Get current page traces
  const currentTraces = useMemo(() => {
    if (!traceData) return [];
    return traceData.traces;
  }, [traceData]);

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/traces')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Traces
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingTraces}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingTraces ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <h1 className="text-4xl font-bold text-foreground dark:text-white mb-2">
            Trace Browser
          </h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Dataset: <code className="font-mono text-sm">{datasetId}</code>
          </p>
        </div>

        {/* Main layout: Filter panel on left, trace list on right */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filter Panel - Takes 1 column on large screens */}
          <div className="lg:col-span-1">
            <TraceFilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              resultsCount={traceData?.total}
              isLoading={isLoadingTraces}
            />
          </div>

          {/* Trace List - Takes 3 columns on large screens */}
          <div className="lg:col-span-3">
            <TraceListViewer
              traces={currentTraces}
              isLoading={isLoadingTraces}
              error={tracesError instanceof Error ? tracesError.message : null}
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={traceData?.total ?? 0}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
