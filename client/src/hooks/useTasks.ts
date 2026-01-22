import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskListResponse } from '@shared/schema';
import { apiFetch } from '@/lib/queryClient';

/**
 * Fetch task list from API
 */
async function fetchTaskList(
  dataset: string,
  limit: number,
  offset: number,
  skipSummary: boolean = false
): Promise<TaskListResponse> {
  const params = new URLSearchParams({
    dataset,
    limit: limit.toString(),
    offset: offset.toString(),
    skipSummary: skipSummary.toString(),
  });

  const response = await apiFetch(`/api/tasks/list?${params}`);

  // Check if response is JSON before attempting to parse
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to fetch tasks');
    }
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }

  if (!isJson) {
    throw new Error('Invalid response from server. Please try again later.');
  }

  return response.json();
}

/**
 * Fetch task summary from API (separate from task list)
 */
async function fetchTaskSummary(
  dataset: string,
  limit: number,
  offset: number
): Promise<{ summary: string; summaryError?: string }> {
  const params = new URLSearchParams({
    dataset,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await apiFetch(`/api/tasks/summary?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch summary');
  }

  return response.json();
}

/**
 * Clear task cache for a dataset
 */
async function clearTaskCache(dataset: string): Promise<void> {
  const response = await apiFetch(`/api/tasks/${encodeURIComponent(dataset)}/clear-cache`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to clear cache');
  }
}

/**
 * Hook to fetch task list with pagination
 */
export function useTaskList(
  dataset: string,
  limit: number = 50,
  offset: number = 0,
  skipSummary: boolean = true
) {
  return useQuery({
    queryKey: ['tasks', dataset, limit, offset],
    queryFn: () => fetchTaskList(dataset, limit, offset, skipSummary),
    enabled: !!dataset,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch task summary separately (for async loading)
 * Note: Summary is dataset-level, not page-specific, so we always use offset=0
 */
export function useTaskSummary(
  dataset: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['taskSummary', dataset],
    queryFn: () => fetchTaskSummary(dataset, 50, 0), // Always use first 50 tasks for summary
    enabled: !!dataset && enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - summaries don't change often
    retry: 1, // Only retry once for summaries
  });
}

/**
 * Hook to clear task cache
 */
export function useClearTaskCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearTaskCache,
    onSuccess: (_, dataset) => {
      // Invalidate all queries for this dataset
      queryClient.invalidateQueries({ queryKey: ['tasks', dataset] });
    },
  });
}
