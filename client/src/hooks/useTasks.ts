import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskListResponse } from '@shared/schema';

/**
 * Fetch task list from API
 */
async function fetchTaskList(dataset: string, limit: number, offset: number): Promise<TaskListResponse> {
  const params = new URLSearchParams({
    dataset,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`/api/tasks/list?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch tasks');
  }

  return response.json();
}

/**
 * Clear task cache for a dataset
 */
async function clearTaskCache(dataset: string): Promise<void> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(dataset)}/clear-cache`, {
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
export function useTaskList(dataset: string, limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['tasks', dataset, limit, offset],
    queryFn: () => fetchTaskList(dataset, limit, offset),
    enabled: !!dataset,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
