import { useQuery } from '@tanstack/react-query';
import type { ApiKeyStatus } from '@shared/schema';
import { apiFetch } from '@/lib/queryClient';

export function useApiKeyStatus() {
  return useQuery<ApiKeyStatus>({
    queryKey: ['apiKeyStatus'],
    queryFn: async () => {
      const response = await apiFetch('/api/config/openai-status');
      if (!response.ok) {
        throw new Error('Failed to fetch API key status');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
