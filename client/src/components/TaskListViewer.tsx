import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChevronDown, ChevronRight, FileText, Loader2, AlertCircle } from 'lucide-react';
import { PaginationControls } from './PaginationControls';
import type { TaskDetail } from '@shared/schema';
import { useState } from 'react';
import { FileViewer } from './FileViewer';

interface TaskListViewerProps {
  tasks: TaskDetail[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TaskListViewer({
  tasks,
  isLoading,
  error,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: TaskListViewerProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleTaskExpand = (taskPath: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskPath)) {
        newSet.delete(taskPath);
      } else {
        newSet.add(taskPath);
      }
      return newSet;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground dark:text-gray-400">Loading tasks...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-semibold text-foreground dark:text-white mb-1">Error loading tasks</p>
              <p className="text-sm text-muted-foreground dark:text-gray-400">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (tasks.length === 0) {
    return (
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground dark:text-gray-400" />
            <p className="text-muted-foreground dark:text-gray-400">No tasks found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <CardHeader>
        <CardTitle className="text-foreground dark:text-white">
          Tasks ({totalItems} total)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-gray-200 dark:border-gray-700">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <TableHead className="w-12"></TableHead>
                <TableHead className="text-foreground dark:text-white">Task Path</TableHead>
                <TableHead className="text-foreground dark:text-white text-right">File Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const isExpanded = expandedTasks.has(task.path);
                const textFiles = task.files.filter(f => f.isText && f.content);

                return (
                  <TableRow
                    key={task.path}
                    className="border-gray-200 dark:border-gray-700"
                  >
                    <TableCell colSpan={3} className="p-0">
                      <Collapsible open={isExpanded} onOpenChange={() => toggleTaskExpand(task.path)}>
                        {/* Main row */}
                        <div className="flex items-center w-full">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-12 w-12 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <div className="flex-1 flex items-center justify-between py-3 pr-4">
                            <span className="font-mono text-sm text-foreground dark:text-white">
                              {task.path}
                            </span>
                            <span className="text-sm text-muted-foreground dark:text-gray-400">
                              {task.files.length} files
                            </span>
                          </div>
                        </div>

                        {/* Expanded content */}
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700">
                            {textFiles.length === 0 ? (
                              <p className="text-sm text-muted-foreground dark:text-gray-400 py-4">
                                No text files found in this task
                              </p>
                            ) : (
                              <div className="space-y-4">
                                <p className="text-sm font-medium text-foreground dark:text-white mb-3">
                                  Task Files ({textFiles.length} text files):
                                </p>
                                <Accordion type="multiple" className="space-y-2">
                                  {textFiles.map((file, idx) => (
                                    <AccordionItem
                                      key={idx}
                                      value={`file-${idx}`}
                                      className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                                    >
                                      <AccordionTrigger className="px-4 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-t-lg">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-primary" />
                                          <span className="font-mono text-sm text-foreground dark:text-white">
                                            {file.path}
                                          </span>
                                          <span className="text-xs text-muted-foreground dark:text-gray-400">
                                            ({file.size} bytes)
                                          </span>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent className="px-4 pb-4">
                                        <FileViewer
                                          file={{
                                            name: file.path,
                                            path: file.path,
                                            size: file.size,
                                            content: file.content ?? "",
                                          }}
                                        />
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>

                                {/* Show count of non-text files if any */}
                                {task.files.length > textFiles.length && (
                                  <p className="text-xs text-muted-foreground dark:text-gray-400 pt-2">
                                    + {task.files.length - textFiles.length} non-text file(s) not shown
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          disabled={isLoading}
        />
      </CardContent>
    </Card>
  );
}
