import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TurnBreakdownDisplay } from './TurnBreakdownDisplay';
import type { AtifTrace } from '@shared/schema';

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
    <div className="space-y-6">
      {/* Metadata Section */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg">Trace Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {metadata.map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-muted-foreground dark:text-gray-400 uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-sm font-mono text-foreground dark:text-gray-100 mt-1 break-all">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conversation Section */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg">
            Conversation ({trace.conversations.length} turns)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {parsedTurns.length === 0 ? (
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                No turns in this conversation
              </p>
            ) : (
              parsedTurns.map((turn, index) => (
                <TurnBreakdownDisplay key={index} turn={turn} index={index} />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Info */}
      <div className="text-xs text-muted-foreground dark:text-gray-400">
        <p>Total turns: {trace.conversations.length}</p>
        <p className="mt-1">
          Model Provider: <Badge variant="outline">{trace.model_provider}</Badge>
        </p>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trace: {trace.run_id}</DialogTitle>
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
