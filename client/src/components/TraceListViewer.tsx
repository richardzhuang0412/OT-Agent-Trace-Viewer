import { useState, useCallback, memo } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConversationViewer } from './ConversationViewer';
import { PaginationControls } from './PaginationControls';
import type { AtifTrace } from '@shared/schema';

interface TraceListViewerProps {
  traces: AtifTrace[];
  isLoading?: boolean;
  error?: string | null;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TraceListViewer({
  traces,
  isLoading = false,
  error,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: TraceListViewerProps) {
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());
  const [selectedTrace, setSelectedTrace] = useState<AtifTrace | null>(null);

  const toggleExpanded = useCallback((runId: string) => {
    setExpandedTraces((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(runId)) {
        newExpanded.delete(runId);
      } else {
        newExpanded.add(runId);
      }
      return newExpanded;
    });
  }, []);

  const selectTrace = useCallback((trace: AtifTrace) => {
    setSelectedTrace(trace);
  }, []);

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20">
        <CardContent className="pt-6">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (traces.length === 0 && !isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            No traces found. Try adjusting your filters.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg">
            Traces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {traces.map((trace) => (
              <TraceRowWrapper
                key={trace.run_id}
                trace={trace}
                expanded={expandedTraces.has(trace.run_id)}
                onToggleExpand={toggleExpanded}
                onViewDetails={selectTrace}
              />
            ))}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading traces...
            </div>
          )}

          {/* Pagination Controls */}
          {totalItems > 0 && !isLoading && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              disabled={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Conversation Viewer Modal */}
      {selectedTrace && (
        <ConversationViewer
          trace={selectedTrace}
          onClose={() => setSelectedTrace(null)}
          open={true}
          isModal={true}
        />
      )}
    </>
  );
}

interface TraceRowWrapperProps {
  trace: AtifTrace;
  expanded: boolean;
  onToggleExpand: (runId: string) => void;
  onViewDetails: (trace: AtifTrace) => void;
}

const TraceRowWrapper = memo(function TraceRowWrapper({
  trace,
  expanded,
  onToggleExpand,
  onViewDetails,
}: TraceRowWrapperProps) {
  const handleToggleExpand = useCallback(() => {
    onToggleExpand(trace.run_id);
  }, [trace.run_id, onToggleExpand]);

  const handleViewDetails = useCallback(() => {
    onViewDetails(trace);
  }, [trace.run_id, onViewDetails]);

  return (
    <TraceRow
      trace={trace}
      expanded={expanded}
      onToggleExpand={handleToggleExpand}
      onViewDetails={handleViewDetails}
    />
  );
});

interface TraceRowProps {
  trace: AtifTrace;
  expanded: boolean;
  onToggleExpand: () => void;
  onViewDetails: () => void;
}

const TraceRow = memo(function TraceRow({
  trace,
  expanded,
  onToggleExpand,
  onViewDetails,
}: TraceRowProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div
        className="p-3 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        onClick={onToggleExpand}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-foreground dark:text-gray-300 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-foreground dark:text-gray-300 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-foreground dark:text-gray-100 truncate">
            {trace.run_id}
          </p>
          <div className="flex gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {trace.model}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {trace.task}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {trace.agent}
            </Badge>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            {trace.conversations.length} turns
          </p>
          <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
            {trace.date}
          </p>
        </div>
      </div>

      {expanded && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-foreground dark:text-gray-300">Run ID:</p>
              <p className="text-muted-foreground dark:text-gray-400 font-mono break-all">
                {trace.run_id}
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground dark:text-gray-300">Trial Name:</p>
              <p className="text-muted-foreground dark:text-gray-400">{trace.trial_name}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground dark:text-gray-300">Model:</p>
              <p className="text-muted-foreground dark:text-gray-400">{trace.model}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground dark:text-gray-300">Model Provider:</p>
              <p className="text-muted-foreground dark:text-gray-400">{trace.model_provider}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground dark:text-gray-300">Task:</p>
              <p className="text-muted-foreground dark:text-gray-400">{trace.task}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground dark:text-gray-300">Agent:</p>
              <p className="text-muted-foreground dark:text-gray-400">{trace.agent}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground dark:text-gray-300">Episode:</p>
              <p className="text-muted-foreground dark:text-gray-400">{trace.episode}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground dark:text-gray-300">Date:</p>
              <p className="text-muted-foreground dark:text-gray-400">{trace.date}</p>
            </div>
          </div>

          <Button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            variant="default"
            size="sm"
            className="w-full"
          >
            View Full Conversation
          </Button>
        </div>
      )}
    </div>
  );
});
