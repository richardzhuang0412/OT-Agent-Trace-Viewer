import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AtifTrace } from '@shared/schema';
import { useMemo } from 'react';
import { TurnBreakdownDisplay } from './TurnBreakdownDisplay';

interface ConversationViewerProps {
  trace: AtifTrace;
  onClose?: () => void;
  open?: boolean;
  isModal?: boolean;
}

export function ConversationViewer({
  trace,
  onClose,
  open = true,
  isModal = false,
}: ConversationViewerProps) {
  // Parse turns into structured format - this would normally call a service
  // For now, we just create a simple parser client-side
  const parsedTurns = useMemo(() => {
    return trace.conversations.map((turn) => ({
      role: turn.role,
      sections: {
        // Very basic parsing - just store raw content
        // The backend service.parseAtifTurn would do this more sophisticatedly
        raw: turn.content,
      },
    }));
  }, [trace.conversations]);

  const metadata = [
    { label: 'Run ID', value: trace.run_id },
    { label: 'Model', value: trace.model },
    { label: 'Agent', value: trace.agent },
    { label: 'Task', value: trace.task },
    { label: 'Trial Name', value: trace.trial_name },
    { label: 'Date', value: trace.date },
    { label: 'Episode', value: String(trace.episode) },
  ];

  const content = (
    <div className="space-y-8">
      {/* Metadata Section */}
      <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
          <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600">Metadata</Badge>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {metadata.map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {label}
              </p>
              <p className="text-sm font-mono text-gray-900 dark:text-gray-100 font-medium break-all">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Interaction History
          </h3>
          <Badge variant="secondary">
            {trace.conversations.length} turns
          </Badge>
        </div>
        
        <div className="space-y-6">
          {parsedTurns.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">
                No interaction turns found in this trace.
              </p>
            </div>
          ) : (
            parsedTurns.map((turn, index) => (
              <TurnBreakdownDisplay key={index} turn={turn} index={index} />
            ))
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
        <span>Run ID: {trace.run_id}</span>
        <div className="flex items-center gap-2">
          <span>Model Provider:</span>
          <Badge variant="outline" className="text-xs">{trace.model_provider}</Badge>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-950 text-foreground dark:text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-black dark:text-white">Trace: {trace.run_id}</DialogTitle>
          </DialogHeader>
          <div className="pr-4">{content}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground dark:text-white">
          Trace: {trace.run_id}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>
      {content}
    </div>
  );
}
