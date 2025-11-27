import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Zap } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';

export default function TracesPage() {
  const [, setLocation] = useLocation();
  const [datasetName, setDatasetName] = useState('');

  const handleGoToTraces = () => {
    if (datasetName.trim()) {
      setLocation(`/traces/${encodeURIComponent(datasetName.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">

          <h1 className="text-4xl font-bold text-foreground dark:text-white mb-2">
            ATIF Trace Viewer
          </h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Browse and analyze agent execution traces from HuggingFace datasets
          </p>
        </div>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-foreground dark:text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Enter Dataset Name
            </CardTitle>
            <CardDescription className="dark:text-gray-400">
              Enter the HuggingFace dataset ID containing ATIF-formatted traces
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., DCAgent2/my-traces-dataset"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGoToTraces()}
                className="flex-1"
              />
              <Button
                onClick={handleGoToTraces}
                disabled={!datasetName.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                Browse Traces
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 bg-muted/50 dark:bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground dark:text-white mb-3">How to use:</h3>
          <ol className="space-y-2 text-muted-foreground dark:text-gray-400">
            <li className="flex gap-2">
              <span className="font-semibold">1.</span>
              <span>Enter a HuggingFace dataset name containing ATIF traces</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">2.</span>
              <span>Click "Browse Traces" to load the dataset</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">3.</span>
              <span>Use filters to find specific traces (model, task, run_id, trial name)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">4.</span>
              <span>Click on any trace to view the full conversation with structured breakdown</span>
            </li>
          </ol>
        </div>

        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-foreground dark:text-white">Expected Data Format:</h3>
          <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground dark:text-gray-400 mb-2">
                Each dataset row should contain an ATIF trace with the following structure:
              </p>
              <pre className="bg-gray-900 dark:bg-gray-800 p-4 rounded text-xs overflow-x-auto text-gray-100">
{`{
  "agent": "agent_name",
  "model": "gpt-4",
  "model_provider": "openai",
  "date": "2024-11-26",
  "task": "coding_task",
  "episode": "1",
  "run_id": "run_123",
  "trial_name": "trial_abc",
  "conversations": [
    {
      "role": "user",
      "content": "..."
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ]
}`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
