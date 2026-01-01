import { TraceFilterPanel } from '@/components/TraceFilterPanel';
import { TraceListViewer } from '@/components/TraceListViewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useClearTraceCache, useTraceList } from '@/hooks/useTraces';
import type { TraceFilterParams } from '@shared/schema';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';

export default function TraceBrowserPage() {
  const params = useParams<{ datasetId: string }>();
  const [, setLocation] = useLocation();
  const datasetId = params.datasetId ? decodeURIComponent(params.datasetId) : '';

  const [filters, setFilters] = useState<Partial<TraceFilterParams>>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const { toast } = useToast();
  const lastWarningRef = useRef<string | null>(null);

  // Calculate offset from page and page size
  const offset = page * pageSize;

  // Fetch traces
  const {
    data: traceData,
    isLoading: isLoadingTraces,
    error: tracesError,
  } = useTraceList(datasetId, { ...filters, offset, limit: pageSize });

  useEffect(() => {
    lastWarningRef.current = null;
  }, [datasetId]);

  useEffect(() => {
    const warning = traceData?.dataset_info?.warning;
    if (warning && lastWarningRef.current !== warning) {
      toast({
        title: 'Trace dataset treated as training',
        description: warning,
        variant: 'destructive',
      });
      lastWarningRef.current = warning;
    }
  }, [traceData?.dataset_info?.warning, toast]);

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://huggingface.co/datasets/${datasetId}`, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View on HuggingFace
            </Button>
          </div>

          <h1 className="text-4xl font-bold text-foreground dark:text-white mb-2">
            Trace Browser
          </h1>
          <div className="space-y-3">
            <p className="text-muted-foreground dark:text-gray-400">
              Dataset: <code className="font-mono text-sm break-all">{datasetId}</code>
            </p>
            {traceData?.dataset_info && (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground dark:text-gray-400">
                  <Badge variant={traceData.dataset_info.kind === 'eval' ? 'default' : 'secondary'}>
                    {traceData.dataset_info.kind === 'eval'
                      ? `Eval • ${traceData.dataset_info.benchmark}`
                      : 'Training dataset'}
                  </Badge>
                  {traceData.dataset_info.score && (
                    <span className="font-medium text-foreground dark:text-gray-100">
                      Score:{' '}
                      <span className="font-mono">
                        {traceData.dataset_info.score.earned.toFixed(2)} /{' '}
                        {traceData.dataset_info.score.total.toFixed(2)}
                      </span>{' '}
                      {traceData.dataset_info.score.total > 0 && (
                        <span className="text-xs text-muted-foreground dark:text-gray-400">
                          (
                          {(
                            (traceData.dataset_info.score.earned / traceData.dataset_info.score.total) *
                            100
                          ).toFixed(1)}
                          %)
                        </span>
                      )}
                    </span>
                  )}
                  {traceData.dataset_info.namespace && (
                    <span>
                      Namespace:{' '}
                      <code className="font-mono text-xs">{traceData.dataset_info.namespace}</code>
                    </span>
                  )}
                  {traceData.dataset_info.kind === 'eval' && traceData.dataset_info.repository && (
                    <span>
                      Repo:{' '}
                      <code className="font-mono text-xs">{traceData.dataset_info.repository}</code>
                    </span>
                  )}
                </div>

                {traceData.dataset_info.successful_tasks &&
                  traceData.dataset_info.successful_tasks.length > 0 && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-4">
                      <p className="text-sm font-medium text-foreground dark:text-gray-100">
                        Tasks with non-zero reward
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {traceData.dataset_info.successful_tasks.map((task) => (
                          <Badge key={task} variant="outline" className="font-mono text-xs">
                            {task}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
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
              datasetId={datasetId}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
