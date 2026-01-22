import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, Zap, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

export default function HomePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-foreground dark:text-white mb-4">
            DCAgent Dataset Viewer
          </h1>
          <p className="text-lg text-muted-foreground dark:text-gray-400">
            Choose a viewer to explore your datasets
          </p>
        </div>

        {/* Viewer Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Task Dataset Viewer */}
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-primary dark:hover:border-primary transition-colors cursor-pointer group">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <FolderOpen className="h-10 w-10 text-primary" />
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <CardTitle className="text-2xl text-foreground dark:text-white">
                Task Dataset Viewer
              </CardTitle>
              <CardDescription className="dark:text-gray-400 text-base">
                Browse and explore task datasets with file extraction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground dark:text-gray-400 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>View tasks from HuggingFace parquet datasets</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Extract and display files from tar.gz archives</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Expandable rows with inline file viewing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Support for instruction.md and all text files</span>
                </li>
              </ul>
              <Button
                onClick={() => setLocation('/tasks')}
                className="w-full"
                size="lg"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Task Viewer
              </Button>
            </CardContent>
          </Card>

          {/* ATIF Trace Viewer */}
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-primary dark:hover:border-primary transition-colors cursor-pointer group">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Zap className="h-10 w-10 text-primary" />
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <CardTitle className="text-2xl text-foreground dark:text-white">
                ATIF Trace Viewer
              </CardTitle>
              <CardDescription className="dark:text-gray-400 text-base">
                Analyze agent execution traces with filtering
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground dark:text-gray-400 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Browse ATIF-formatted agent traces</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Filter by model, task, run ID, and trial name</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>View detailed conversation breakdowns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Analyze agent behavior and interactions</span>
                </li>
              </ul>
              <Button
                onClick={() => setLocation('/traces')}
                className="w-full"
                size="lg"
              >
                <Zap className="h-4 w-4 mr-2" />
                Open Trace Viewer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <div className="mt-12 bg-muted/50 dark:bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground dark:text-white mb-3">
            About the Viewers
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground dark:text-gray-400">
            <div>
              <h4 className="font-semibold text-foreground dark:text-white mb-2">Task Dataset Viewer</h4>
              <p>
                Use this viewer to explore task datasets where each row contains a compressed
                tar.gz archive with task files. Perfect for browsing task definitions,
                instructions, and related configuration files.
              </p>
              <p className="mt-2 text-xs">
                Example: <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">DCAgent/selfinstruct-naive-sandboxes-1</code>
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground dark:text-white mb-2">ATIF Trace Viewer</h4>
              <p>
                Use this viewer to analyze agent execution traces in ATIF format.
                Ideal for debugging agent behavior, understanding conversation flows,
                and identifying patterns in agent interactions.
              </p>
              <p className="mt-2 text-xs">
                Example: <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">DCAgent2/DCAgent_dev_set_71_tasks_DCAgent_nl2bash-nl2bash-bugsseq_Qwen3-8B-maxEps24-11291867e6d9</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
