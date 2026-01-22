import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AtifTrace, TraceFilterParams, TraceListResponse, TraceMetadata } from "@shared/schema";
import { apiFetch } from "@/lib/queryClient";

/**
 * Helper to check if response is JSON and parse it safely
 */
async function parseJsonResponse<T>(response: Response, errorPrefix: string): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `${errorPrefix}: ${response.statusText}`);
    }
    throw new Error(`${errorPrefix}: ${response.status} ${response.statusText}`);
  }

  if (!isJson) {
    throw new Error(`${errorPrefix}: Invalid response from server`);
  }

  return response.json();
}

/**
 * Hook to fetch a list of traces with optional filtering
 */
export function useTraceList(dataset: string, filters: Partial<TraceFilterParams> = {}) {
  return useQuery<TraceListResponse>({
    queryKey: ["/api/traces/list", dataset, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        dataset,
        ...Object.entries(filters).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>),
      });

      const response = await apiFetch(`/api/traces/list?${params}`);
      return parseJsonResponse<TraceListResponse>(response, 'Failed to fetch traces');
    },
    enabled: !!dataset,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single trace by run_id
 */
export function useTrace(dataset: string, runId: string) {
  return useQuery<AtifTrace>({
    queryKey: ["/api/traces", dataset, runId],
    queryFn: async () => {
      const response = await apiFetch(`/api/traces/${dataset}/${runId}`);
      return parseJsonResponse<AtifTrace>(response, 'Failed to fetch trace');
    },
    enabled: !!dataset && !!runId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch metadata about traces (for filter options)
 */
export function useTraceMetadata(dataset: string) {
  return useQuery<TraceMetadata>({
    queryKey: ["/api/traces/metadata", dataset],
    queryFn: async () => {
      const response = await apiFetch(`/api/traces/${dataset}/metadata`);
      return parseJsonResponse<TraceMetadata>(response, 'Failed to fetch metadata');
    },
    enabled: !!dataset,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to clear trace cache (useful after updates or refreshes)
 */
export function useClearTraceCache() {
  const queryClient = useQueryClient();

  const clearCache = async (dataset: string) => {
    try {
      const response = await apiFetch(`/api/traces/${dataset}/clear-cache`, {
        method: "POST",
      });
      
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      if (!response.ok) {
        if (isJson) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error || `Failed to clear cache: ${response.statusText}`);
        }
        throw new Error(`Failed to clear cache: ${response.status} ${response.statusText}`);
      }
      
      // Invalidate all trace queries for this dataset
      queryClient.invalidateQueries({
        queryKey: ["/api/traces/list", dataset],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/traces/metadata", dataset],
      });
    } catch (error) {
      console.error("Error clearing trace cache:", error);
      throw error;
    }
  };

  return { clearCache };
}
