import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database, ArrowLeft, Search } from 'lucide-react';

export default function DatasetsPage() {
  const [, setLocation] = useLocation();
  const [datasetName, setDatasetName] = useState('');

  const handleGoToDataset = () => {
    if (datasetName.trim()) {
      setLocation(`/datasets/${encodeURIComponent(datasetName.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/s3">
              <Button variant="ghost" size="sm" data-testid="button-s3">
                <ArrowLeft className="h-4 w-4 mr-2" />
                S3 Viewer
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-foreground dark:text-white mb-2">
            HuggingFace Dataset Browser
          </h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Enter a HuggingFace dataset name to view its contents
          </p>
        </div>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-foreground dark:text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Enter Dataset Name
            </CardTitle>
            <CardDescription className="dark:text-gray-400">
              Examples: mlfoundations-dev/_c_eansandboxestasksev_set_inferredbugs_sandboxes_traces_terminus_2_20251008_010358
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., username/dataset-name"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGoToDataset()}
                className="flex-1"
                data-testid="input-dataset-name"
              />
              <Button 
                onClick={handleGoToDataset}
                disabled={!datasetName.trim()}
                data-testid="button-go-dataset"
              >
                <Search className="h-4 w-4 mr-2" />
                Go
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 bg-muted/50 dark:bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground dark:text-white mb-3">How to use:</h3>
          <ol className="space-y-2 text-muted-foreground dark:text-gray-400">
            <li className="flex gap-2">
              <span className="font-semibold">1.</span>
              <span>Enter a HuggingFace dataset name (e.g., "username/dataset-name")</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">2.</span>
              <span>Click "Go" or press Enter to view the dataset rows</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">3.</span>
              <span>Click on any row to extract tar files (if present)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">4.</span>
              <span>Click "Run LM Judge" to analyze failures using AI</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
