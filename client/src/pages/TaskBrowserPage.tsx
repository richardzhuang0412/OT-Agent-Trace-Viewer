import { TaskListViewer } from '@/components/TaskListViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useClearTaskCache, useTaskList, useTaskSummary } from '@/hooks/useTasks';
import { useApiKeyStatus } from '@/hooks/useApiKeyStatus';
import { getRandomTaskPage } from '@/lib/taskSampler';
import { ArrowLeft, ExternalLink, RefreshCw, Shuffle, Info, Settings, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ApiKeyConfigModal } from '@/components/ApiKeyConfigModal';
import { useQueryClient } from '@tanstack/react-query';

export default function TaskBrowserPage() {
  const params = useParams<{ datasetId: string }>();
  const [, setLocation] = useLocation();
  const datasetId = params.datasetId ? decodeURIComponent(params.datasetId) : '';

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Calculate offset from page and page size
  const offset = page * pageSize;

  // Fetch tasks (fast - without summary)
  const {
    data: taskData,
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useTaskList(datasetId, pageSize, offset, true); // skipSummary=true

  // Fetch summary separately (slow - async, dataset-level)
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    error: summaryError,
  } = useTaskSummary(datasetId);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: apiKeyStatus } = useApiKeyStatus();

  // Check if summary error is due to missing API key
  const isApiKeyRequired = summaryData?.summaryError === 'OPENAI_API_KEY_REQUIRED';

  useEffect(() => {
    // Only show error toast if it's not an API key error (we handle that separately)
    if (summaryData?.summaryError && !isApiKeyRequired) {
      toast({
        title: 'Task dataset summary unavailable',
        description: summaryData.summaryError,
        variant: 'destructive',
      });
    }
  }, [summaryData?.summaryError, isApiKeyRequired, toast]);

  const handleApiKeyConfigured = () => {
    // Invalidate summary query to refetch with new API key
    queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
    setShowApiKeyModal(false);
  };

  // Cache clearing
  const { mutate: clearCache } = useClearTaskCache();

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(0); // Reset to first page when page size changes
  };

  const handleRefresh = () => {
    clearCache(datasetId);
  };

  const handleResample = () => {
    if (!taskData?.total) {
      return;
    }
    const randomPage = getRandomTaskPage(taskData.total, pageSize);
    setPage(randomPage);
    clearCache(datasetId);
  };

  // Calculate total pages
  const totalPages = useMemo(() => {
    if (!taskData || taskData.total === 0) return 0;
    return Math.ceil(taskData.total / pageSize);
  }, [taskData, pageSize]);

  // Get current page tasks
  const currentTasks = useMemo(() => {
    if (!taskData) return [];
    return taskData.tasks;
  }, [taskData]);

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/tasks')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Tasks
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingTasks}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingTasks ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResample}
              disabled={isLoadingTasks || !taskData?.total}
              className="gap-2"
            >
              <Shuffle className="h-4 w-4" />
              Resample
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApiKeyModal(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              API Key
              <div className={`w-2 h-2 rounded-full ${apiKeyStatus?.hasKey ? 'bg-green-500' : 'bg-gray-400'}`} />
            </Button>
          </div>

          <h1 className="text-4xl font-bold text-foreground dark:text-white mb-2">
            Task Browser
          </h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Dataset: <code className="font-mono text-sm">{datasetId}</code>
          </p>
        </div>

        {/* Task Summary or API Key Required Info */}
        {isLoadingSummary ? (
          <Card className="mb-6 border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Generating Task Dataset Overview...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Analyzing tasks and generating summary. This may take a moment.
              </p>
            </CardContent>
          </Card>
        ) : summaryError ? (
          <Card className="mb-6 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                Unable to generate summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-red-600 dark:text-red-400">
                {summaryError instanceof Error ? summaryError.message : 'An error occurred'}
              </p>
            </CardContent>
          </Card>
        ) : isApiKeyRequired ? (
          <Card className="mb-6 border-blue-500/50 bg-blue-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                API Key Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Task summaries require an OpenAI API key to generate. Configure your API key to view dataset summaries.
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowApiKeyModal(true)}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Configure API Key
              </Button>
            </CardContent>
          </Card>
        ) : summaryData?.summary && summaryData.summary !== 'Summary not available.' ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Task Dataset Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {summaryData.summary}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Task List */}
        <TaskListViewer
          tasks={currentTasks}
          isLoading={isLoadingTasks}
          error={tasksError instanceof Error ? tasksError.message : null}
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={taskData?.total ?? 0}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />

        {/* API Key Configuration Modal */}
        <ApiKeyConfigModal
          open={showApiKeyModal}
          onOpenChange={setShowApiKeyModal}
          onSuccess={handleApiKeyConfigured}
        />
      </div>
    </div>
  );
}
