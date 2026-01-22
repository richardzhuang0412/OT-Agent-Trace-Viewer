import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiKeyConfigResponse } from '@shared/schema';
import { storeApiKey, clearApiKey } from '@/lib/apiKeyStorage';

export function useApiKeyConfig() {
  const queryClient = useQueryClient();

  const configureKey = useMutation<ApiKeyConfigResponse, Error, { apiKey: string }>({
    mutationFn: async ({ apiKey }) => {
      const response = await fetch('/api/config/openai-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to configure API key');
      }

      const result = await response.json();
      // Store in localStorage after server validates the key
      storeApiKey(apiKey);
      return result;
    },
    onSuccess: () => {
      // Invalidate API key status query to refetch
      queryClient.invalidateQueries({ queryKey: ['apiKeyStatus'] });
    },
  });

  const clearKeyMutation = useMutation<{ success: boolean }, Error>({
    mutationFn: async () => {
      // Clear from localStorage
      clearApiKey();

      const response = await fetch('/api/config/openai-key', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to clear API key');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate API key status query to refetch
      queryClient.invalidateQueries({ queryKey: ['apiKeyStatus'] });
    },
  });

  return {
    configureKey,
    clearKey: clearKeyMutation,
  };
}
