import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, FileArchive, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { HfDatasetRowsResponse, TarFileContent, LmJudgeResult } from '@shared/schema';

export default function DatasetRowsPage() {
  const [, params] = useRoute('/datasets/:datasetId');
  const datasetId = params?.datasetId ? decodeURIComponent(params.datasetId) : '';
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [tarContents, setTarContents] = useState<TarFileContent[] | null>(null);
  const [judgeResult, setJudgeResult] = useState<LmJudgeResult | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);
  const { toast } = useToast();
  const tarSectionRef = useRef<HTMLDivElement>(null);
  
  const filesPerPage = 100;

  const { data: rowsData, isLoading, error: rowsError } = useQuery<HfDatasetRowsResponse>({
    queryKey: ['/api/hf/rows', datasetId],
    queryFn: async () => {
      const response = await fetch(`/api/hf/rows?dataset=${encodeURIComponent(datasetId)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dataset rows');
      }
      return response.json();
    },
    enabled: !!datasetId,
  });

  // Show error toast when rows fail to load
  useEffect(() => {
    if (rowsError) {
      toast({
        title: 'Error loading rows',
        description: rowsError instanceof Error ? rowsError.message : 'Failed to fetch dataset rows',
        variant: 'destructive',
      });
    }
  }, [rowsError, toast]);

  const extractTarMutation = useMutation({
    mutationFn: async (rowData: any) => {
      // Find tar file in row data
      let tarUrl = null;
      let tarBase64 = null;

      for (const [key, value] of Object.entries(rowData)) {
        if (typeof value === 'string' && value.includes('.tar')) {
          tarUrl = value;
          break;
        }
        // Check if it's base64 encoded tar data
        if (typeof value === 'string' && value.length > 1000 && !value.startsWith('http')) {
          tarBase64 = value;
          break;
        }
      }

      const response = await apiRequest('POST', '/api/hf/extract-tar', { tarUrl, tarBase64 });
      return await response.json();
    },
    onSuccess: (data: { files: TarFileContent[] }) => {
      setTarContents(data.files);
      toast({
        title: 'Success',
        description: `Extracted ${data.files.length} files from tar archive`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to extract tar file',
        variant: 'destructive',
      });
    },
  });

  const judgeMutation = useMutation({
    mutationFn: async (files: TarFileContent[]) => {
      const response = await apiRequest('POST', '/api/hf/judge', { files });
      return await response.json();
    },
    onSuccess: (data: LmJudgeResult) => {
      setJudgeResult(data);
      setIsJudgeModalOpen(true);
      toast({
        title: 'Analysis Complete',
        description: 'LM judge has analyzed the test run',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run LM judge',
        variant: 'destructive',
      });
    },
  });

  const handleRowClick = async (rowIdx: number, rowData: any) => {
    setSelectedRow(rowIdx);
    setTarContents(null);
    setJudgeResult(null);
    setCurrentPage(0);
    
    // Check if row contains tar file before extracting
    const hasTarFile = Object.values(rowData).some((value) => 
      typeof value === 'string' && (value.includes('.tar') || value.length > 1000)
    );
    
    if (!hasTarFile) {
      toast({
        title: 'No tar file found',
        description: 'This row does not contain a tar file',
        variant: 'destructive',
      });
      return;
    }
    
    // Scroll to tar section with smooth animation
    setTimeout(() => {
      tarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    extractTarMutation.mutate(rowData);
  };

  const handleRunJudge = () => {
    if (tarContents) {
      judgeMutation.mutate(tarContents);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-10 w-64 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/datasets">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Datasets
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-foreground dark:text-white mb-2">
            {datasetId.split('/').pop()}
          </h1>
          <p className="text-muted-foreground dark:text-gray-400">{datasetId}</p>
        </div>

        <div className="space-y-6">
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-foreground dark:text-white">Dataset Rows</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Total: {rowsData?.num_rows_total || 0} rows
              </p>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground dark:text-white">Row #</TableHead>
                      <TableHead className="text-foreground dark:text-white">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsData?.rows.map((row) => (
                      <TableRow
                        key={row.row_idx}
                        className={`cursor-pointer ${selectedRow === row.row_idx ? 'bg-primary/10' : ''}`}
                        onClick={() => handleRowClick(row.row_idx, row.row)}
                        data-testid={`row-dataset-${row.row_idx}`}
                      >
                        <TableCell className="font-medium text-foreground dark:text-white">
                          {row.row_idx}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground dark:text-gray-400">
                          <div className="max-w-md truncate">
                            {JSON.stringify(row.row).substring(0, 100)}...
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div ref={tarSectionRef} className="space-y-6">
            {extractTarMutation.isPending && (
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground dark:text-gray-400">Extracting tar file...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {tarContents && (
              <>
                <Button
                  onClick={handleRunJudge}
                  disabled={judgeMutation.isPending}
                  className="w-full"
                  size="lg"
                  data-testid="button-run-judge"
                >
                  {judgeMutation.isPending && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                  Run LM Judge
                </Button>
                {judgeResult && (
                  <Button
                    onClick={() => setIsJudgeModalOpen(true)}
                    variant="outline"
                    size="lg"
                    className="w-full"
                    data-testid="button-view-results"
                  >
                    View Results
                  </Button>
                )}
                
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-foreground dark:text-white flex items-center gap-2">
                      <FileArchive className="h-5 w-5" />
                      Tar Contents ({tarContents.length} files)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                  {tarContents.length > filesPerPage && (
                    <div className="mb-4 flex items-center justify-between">
                      <Button
                        onClick={handlePrevPage}
                        variant="outline"
                        disabled={currentPage === 0}
                        data-testid="button-prev-page-top"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground dark:text-gray-400">
                        Showing {currentPage * filesPerPage + 1}-{Math.min((currentPage + 1) * filesPerPage, tarContents.length)} of {tarContents.length} files
                      </span>
                      <Button
                        onClick={handleNextPage}
                        variant="outline"
                        disabled={(currentPage + 1) * filesPerPage >= tarContents.length}
                        data-testid="button-next-page-top"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                  <Accordion type="single" collapsible className="w-full">
                    {tarContents.slice(currentPage * filesPerPage, (currentPage + 1) * filesPerPage).map((file, idx) => {
                      const actualIdx = currentPage * filesPerPage + idx;
                      return (
                        <AccordionItem key={actualIdx} value={`file-${actualIdx}`}>
                          <AccordionTrigger className="text-sm text-foreground dark:text-white">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {file.type}
                              </Badge>
                              <span className="truncate">{file.path}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="text-xs space-y-2">
                              <div className="text-muted-foreground dark:text-gray-400">
                                Size: {file.size} bytes
                              </div>
                              {file.content && (
                                <pre className="bg-muted dark:bg-gray-800 p-3 rounded-md overflow-auto max-h-64 text-foreground dark:text-white">
                                  {file.content}
                                </pre>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                  {tarContents.length > filesPerPage && (
                    <div className="mt-4 flex items-center justify-between">
                      <Button
                        onClick={handlePrevPage}
                        variant="outline"
                        disabled={currentPage === 0}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground dark:text-gray-400">
                        Showing {currentPage * filesPerPage + 1}-{Math.min((currentPage + 1) * filesPerPage, tarContents.length)} of {tarContents.length} files
                      </span>
                      <Button
                        onClick={handleNextPage}
                        variant="outline"
                        disabled={(currentPage + 1) * filesPerPage >= tarContents.length}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Dialog open={isJudgeModalOpen} onOpenChange={setIsJudgeModalOpen}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-black text-white">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    LM Judge Analysis
                  </DialogTitle>
                </DialogHeader>
                {judgeResult && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-white">Summary</h4>
                      <p className="text-sm text-gray-400">{judgeResult.summary}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-white">Analysis</h4>
                      <p className="text-sm text-gray-400">{judgeResult.analysis}</p>
                    </div>

                    {judgeResult.failures.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 text-white">
                          Failures ({judgeResult.failures.length})
                        </h4>
                        <div className="space-y-3">
                          {judgeResult.failures.map((failure, idx) => (
                            <div
                              key={idx}
                              className="border border-gray-700 rounded-lg p-3"
                              data-testid={`failure-${idx}`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                {failure.severity === 'critical' || failure.severity === 'high' ? (
                                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-white">{failure.issue}</span>
                                    <Badge className={getSeverityColor(failure.severity)}>
                                      {failure.severity}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-400">
                                    {failure.explanation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
        </div>
      </div>
    </div>
  );
}
