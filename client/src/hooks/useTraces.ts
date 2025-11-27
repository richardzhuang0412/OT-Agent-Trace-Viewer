import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AtifTrace, TraceFilterParams, TraceListResponse, TraceMetadata } from "@shared/schema";

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

      const response = await fetch(`/api/traces/list?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch traces: ${response.statusText}`);
      }
      return response.json();
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
      const response = await fetch(`/api/traces/${dataset}/${runId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch trace: ${response.statusText}`);
      }
      return response.json();
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
      const response = await fetch(`/api/traces/${dataset}/metadata`);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
      }
      return response.json();
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
      const response = await fetch(`/api/traces/${dataset}/clear-cache`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Failed to clear cache: ${response.statusText}`);
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
