import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { retrieveApiKey } from "./apiKeyStorage";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getApiKeyHeaders(): Record<string, string> {
  const apiKey = retrieveApiKey();
  return apiKey ? { 'X-OpenAI-Api-Key': apiKey } : {};
}

// Centralized fetch wrapper that injects API key header
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const existingHeaders = options.headers as Record<string, string> | undefined;
  const headers: Record<string, string> = {
    ...getApiKeyHeaders(),
    ...(existingHeaders || {}),
  };

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getApiKeyHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: getApiKeyHeaders(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
