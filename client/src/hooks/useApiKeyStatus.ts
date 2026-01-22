import { useQuery } from '@tanstack/react-query';
import type { ApiKeyStatus } from '@shared/schema';
import { retrieveApiKey } from '@/lib/apiKeyStorage';

export function useApiKeyStatus() {
  return useQuery<ApiKeyStatus>({
    queryKey: ['apiKeyStatus'],
    queryFn: async () => {
      const localKey = retrieveApiKey();
      const headers: HeadersInit = localKey
        ? { 'X-OpenAI-Api-Key': localKey }
        : {};

      const response = await fetch('/api/config/openai-status', {
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch API key status');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
