import { TaskListViewer } from '@/components/TaskListViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useClearTaskCache, useTaskList } from '@/hooks/useTasks';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';

export default function TaskBrowserPage() {
  const params = useParams<{ datasetId: string }>();
  const [, setLocation] = useLocation();
  const datasetId = params.datasetId ? decodeURIComponent(params.datasetId) : '';

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Calculate offset from page and page size
  const offset = page * pageSize;

  // Fetch tasks
  const {
    data: taskData,
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useTaskList(datasetId, pageSize, offset);
  const { toast } = useToast();

  useEffect(() => {
    if (taskData?.summaryError) {
      toast({
        title: 'Task dataset summary unavailable',
        description: taskData.summaryError,
        variant: 'destructive',
      });
    }
  }, [taskData?.summaryError, toast]);

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
              onClick={() => window.open(`https://huggingface.co/datasets/${datasetId}`, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View on HuggingFace
            </Button>
          </div>

          <h1 className="text-4xl font-bold text-foreground dark:text-white mb-2">
            Task Browser
          </h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Dataset: <code className="font-mono text-sm">{datasetId}</code>
          </p>
        </div>

        {/* Task Summary */}
        {taskData?.summary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Task Dataset Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {taskData.summary}
              </p>
            </CardContent>
          </Card>
        )}

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
      </div>
    </div>
  );
}
