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
  const [isBulkJudgeModalOpen, setIsBulkJudgeModalOpen] = useState(false);
  const [bulkJudgeResult, setBulkJudgeResult] = useState<LmJudgeResult | null>(null);
  const [bulkJudgeBatchOffset, setBulkJudgeBatchOffset] = useState(0);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [rowsOffset, setRowsOffset] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const { toast } = useToast();
  const tarSectionRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const lastLoadedOffsetRef = useRef<number>(-1);
  
  const filesPerPage = 100;
  const rowsPerPage = 100;
  const bulkJudgeBatchSize = 500;

  const { data: rowsData, isLoading, error: rowsError, refetch: refetchRows } = useQuery<HfDatasetRowsResponse>({
    queryKey: ['/api/hf/rows', datasetId, rowsOffset],
    queryFn: async () => {
      const response = await fetch(`/api/hf/rows?dataset=${encodeURIComponent(datasetId)}&length=${rowsPerPage}&offset=${rowsOffset}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch dataset rows:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.error || `Failed to fetch dataset rows (${response.status})`);
      }
      return response.json();
    },
    enabled: !!datasetId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Reset state when dataset changes
  useEffect(() => {
    setRowsOffset(0);
    setAllRows([]);
    setTotalRows(0);
    setSelectedRow(null);
    setTarContents(null);
    setJudgeResult(null);
    lastLoadedOffsetRef.current = -1;
  }, [datasetId]);

  // Update allRows when new data is fetched
  useEffect(() => {
    if (rowsData?.rows) {
      if (rowsOffset === 0) {
        // First load or refetch at offset 0 - always replace
        setAllRows(rowsData.rows);
        lastLoadedOffsetRef.current = 0;
      } else if (lastLoadedOffsetRef.current !== rowsOffset) {
        // New offset - append rows
        setAllRows(prev => [...prev, ...rowsData.rows]);
        lastLoadedOffsetRef.current = rowsOffset;
      }
      setTotalRows(rowsData.num_rows_total || 0);
    }
  }, [rowsData, rowsOffset]);

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

  const bulkJudgeMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const response = await apiRequest('POST', '/api/hf/judge-all-rows', { rows });
      return await response.json();
    },
    onSuccess: (data: LmJudgeResult) => {
      setBulkJudgeResult(data);
      setIsBulkJudgeModalOpen(true);
      toast({
        title: 'Bulk Analysis Complete',
        description: 'LM judge has analyzed all dataset rows',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run bulk LM judge',
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

  const handleRunBulkJudge = async () => {
    try {
      const batchSize = 100;
      const rowsToFetch: any[] = [];
      const startRow = bulkJudgeBatchOffset;
      const endRow = Math.min(bulkJudgeBatchOffset + bulkJudgeBatchSize, totalRows);
      
      toast({
        title: 'Fetching rows',
        description: `Fetching rows ${startRow}-${endRow} for analysis...`,
      });

      // Fetch rows in batches of 100 up to 500 total from the current offset
      for (let offset = bulkJudgeBatchOffset; offset < bulkJudgeBatchOffset + bulkJudgeBatchSize && offset < totalRows; offset += batchSize) {
        const response = await fetch(
          `/api/hf/rows?dataset=${encodeURIComponent(datasetId)}&offset=${offset}&length=${batchSize}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch rows');
        }
        
        const data = await response.json();
        
        if (data.rows && data.rows.length > 0) {
          rowsToFetch.push(...data.rows);
        }
        
        // Stop if we got fewer rows than requested (reached end of dataset)
        if (!data.rows || data.rows.length < batchSize) {
          break;
        }
      }

      if (rowsToFetch.length === 0) {
        toast({
          title: 'No rows found',
          description: 'No rows available for analysis in this batch',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Running analysis',
        description: `Analyzing ${rowsToFetch.length} rows (${startRow}-${startRow + rowsToFetch.length - 1}) with LM judge...`,
      });

      bulkJudgeMutation.mutate(rowsToFetch);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch rows for bulk analysis',
        variant: 'destructive',
      });
    }
  };

  const handleNextBulkBatch = () => {
    const newOffset = bulkJudgeBatchOffset + bulkJudgeBatchSize;
    if (newOffset < totalRows) {
      setBulkJudgeBatchOffset(newOffset);
    }
  };

  const handlePrevBulkBatch = () => {
    const newOffset = Math.max(0, bulkJudgeBatchOffset - bulkJudgeBatchSize);
    setBulkJudgeBatchOffset(newOffset);
  };

  // Infinite scroll handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPosition = target.scrollTop + target.clientHeight;
    const scrollHeight = target.scrollHeight;
    
    // Load more when scrolled within 100px of bottom
    const isNearBottom = scrollHeight - scrollPosition < 100;
    
    if (isNearBottom && !isLoading && allRows.length < totalRows) {
      setRowsOffset(prev => prev + rowsPerPage);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const errorLabels: Record<keyof LmJudgeResult['errorCounts'], string> = {
    functionCallError: 'Agent called a function incorrectly',
    malformedJson: 'Agent produced malformed JSON',
    factualComputationalError: 'Agent made a factual or computational error',
    exceededContextWindow: 'Agent exceeded context window',
    misunderstoodInstructions: 'Agent misunderstood task instructions or that it was a terminal agent',
    shellToolMisuse: 'Agent misused a shell tool',
    noTaskConfirmation: 'Agent did not confirm task completion when prompted',
    exhaustedDiskSpace: 'Agent exhausted disk space',
    hallucinatedSolutions: 'Agent hallucinated solutions or attempted to cheat',
    systemFailure: 'Non-agent system failure',
    otherAgentError: 'Any other agent-caused error',
  };

  const isInitialLoading = isLoading && rowsOffset === 0 && allRows.length === 0;
  
  if (isInitialLoading) {
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
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground dark:text-white">Dataset Rows</CardTitle>
                    <p className="text-sm text-muted-foreground dark:text-gray-400">
                      Showing {allRows.length} of {totalRows} rows
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-muted/50 dark:bg-gray-800/50">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground dark:text-white">
                      Bulk LM Judge Analysis
                    </span>
                    <span className="text-xs text-muted-foreground dark:text-gray-400">
                      Batch: Rows {bulkJudgeBatchOffset} - {Math.min(bulkJudgeBatchOffset + bulkJudgeBatchSize, totalRows)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handlePrevBulkBatch}
                      disabled={bulkJudgeBatchOffset === 0 || bulkJudgeMutation.isPending}
                      variant="outline"
                      size="sm"
                      data-testid="button-prev-bulk-batch"
                    >
                      Previous 500
                    </Button>
                    <Button
                      onClick={handleRunBulkJudge}
                      disabled={bulkJudgeMutation.isPending || totalRows === 0}
                      data-testid="button-run-bulk-judge"
                      variant="default"
                      size="sm"
                    >
                      {bulkJudgeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Run Judge
                    </Button>
                    <Button
                      onClick={handleNextBulkBatch}
                      disabled={bulkJudgeBatchOffset + bulkJudgeBatchSize >= totalRows || bulkJudgeMutation.isPending}
                      variant="outline"
                      size="sm"
                      data-testid="button-next-bulk-batch"
                    >
                      Next 500
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                ref={tableScrollRef}
                className="max-h-[600px] overflow-auto"
                onScroll={handleScroll}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground dark:text-white">Row #</TableHead>
                      <TableHead className="text-foreground dark:text-white">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allRows.length === 0 && !isLoading ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-8">
                          <div className="text-muted-foreground">
                            No rows found in this dataset
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {allRows.map((row) => (
                          <TableRow
                            key={row.row_idx}
                            className={`cursor-pointer transition-colors ${
                              selectedRow === row.row_idx 
                                ? 'bg-primary/20 dark:bg-primary/30 border-l-4 border-primary' 
                                : 'hover:bg-muted/50 dark:hover:bg-gray-800/50'
                            }`}
                            onClick={() => handleRowClick(row.row_idx, row.row)}
                            data-testid={`row-dataset-${row.row_idx}`}
                          >
                            <TableCell className="font-medium text-foreground dark:text-white">
                              <div className="flex items-center gap-2">
                                {selectedRow === row.row_idx && extractTarMutation.isPending && (
                                  <Loader2 className="h-4 w-4 animate-spin text-primary" data-testid="loader-row-loading" />
                                )}
                                {row.row_idx}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground dark:text-gray-400">
                              <div className="max-w-md truncate">
                                {JSON.stringify(row.row).substring(0, 100)}...
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {isLoading && allRows.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-4">
                              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading more rows...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
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
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-black text-white">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    LM Judge Analysis
                  </DialogTitle>
                </DialogHeader>
                {judgeResult && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-2 text-white">Summary</h4>
                      <p className="text-sm text-gray-400">{judgeResult.summary}</p>
                    </div>

                    {judgeResult.runDetails && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-white">Run Details</h4>
                        
                        {judgeResult.runDetails.config && (
                          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                            <h5 className="text-sm font-medium text-gray-300 mb-2">Config</h5>
                            <pre className="text-xs text-gray-400 overflow-x-auto">
                              {JSON.stringify(judgeResult.runDetails.config, null, 2)}
                            </pre>
                          </div>
                        )}

                        {judgeResult.runDetails.result && (
                          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                            <h5 className="text-sm font-medium text-gray-300 mb-2">Result</h5>
                            <pre className="text-xs text-gray-400 overflow-x-auto">
                              {JSON.stringify(judgeResult.runDetails.result, null, 2)}
                            </pre>
                          </div>
                        )}

                        {judgeResult.runDetails.exception && (
                          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                            <h5 className="text-sm font-medium text-gray-300 mb-2">Exception</h5>
                            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                              {judgeResult.runDetails.exception}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold mb-3 text-white">Error Counts</h4>
                      
                      {(() => {
                        const totalErrors = Object.values(judgeResult.errorCounts).reduce((sum, count) => sum + count, 0);
                        return (
                          <div className="mb-4 p-4 bg-gray-900 border border-gray-700 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300 font-medium">Total Failures</span>
                              <Badge 
                                variant="default"
                                className={`text-lg px-4 py-1 ${totalErrors > 0 ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
                                data-testid="badge-total-errors"
                              >
                                {totalErrors}
                              </Badge>
                            </div>
                          </div>
                        );
                      })()}
                      
                      <div className="border border-gray-700 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-gray-700 hover:bg-gray-900">
                              <TableHead className="text-gray-300">Error Type</TableHead>
                              <TableHead className="text-gray-300 text-right">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(judgeResult.errorCounts).map(([key, count]) => (
                              <TableRow
                                key={key}
                                className="border-gray-700 hover:bg-gray-900"
                                data-testid={`error-row-${key}`}
                              >
                                <TableCell className="text-gray-400 text-sm">
                                  {errorLabels[key as keyof typeof errorLabels]}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge 
                                    variant={count > 0 ? "default" : "outline"}
                                    className={count > 0 ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 border-gray-600"}
                                  >
                                    {count}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

          <Dialog open={isBulkJudgeModalOpen} onOpenChange={setIsBulkJudgeModalOpen}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-black text-white">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    LM Judge Analysis - All Rows
                  </DialogTitle>
                </DialogHeader>
                {bulkJudgeResult && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-2 text-white">Summary</h4>
                      <p className="text-sm text-gray-400">{bulkJudgeResult.summary}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3 text-white">Error Counts</h4>
                      
                      {(() => {
                        const totalErrors = Object.values(bulkJudgeResult.errorCounts).reduce((sum, count) => sum + count, 0);
                        return (
                          <div className="mb-4 p-4 bg-gray-900 border border-gray-700 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300 font-medium">Total Failures Across All Rows</span>
                              <Badge 
                                variant="default"
                                className={`text-lg px-4 py-1 ${totalErrors > 0 ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
                                data-testid="badge-total-errors-bulk"
                              >
                                {totalErrors}
                              </Badge>
                            </div>
                          </div>
                        );
                      })()}
                      
                      <div className="border border-gray-700 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-gray-700 hover:bg-gray-900">
                              <TableHead className="text-gray-300">Error Type</TableHead>
                              <TableHead className="text-gray-300 text-right">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(bulkJudgeResult.errorCounts).map(([key, count]) => (
                              <TableRow
                                key={key}
                                className="border-gray-700 hover:bg-gray-900"
                                data-testid={`error-row-bulk-${key}`}
                              >
                                <TableCell className="text-gray-400 text-sm">
                                  {errorLabels[key as keyof typeof errorLabels]}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge 
                                    variant={count > 0 ? "default" : "outline"}
                                    className={count > 0 ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 border-gray-600"}
                                  >
                                    {count}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
        </div>
      </div>
    </div>
  );
}
