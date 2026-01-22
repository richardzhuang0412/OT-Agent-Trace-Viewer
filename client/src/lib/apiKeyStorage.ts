const STORAGE_KEY = 'openai_api_key';
const PREFIX = 'oai_v1_';

export function storeApiKey(apiKey: string): void {
  localStorage.setItem(STORAGE_KEY, PREFIX + btoa(apiKey));
}

export function retrieveApiKey(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored?.startsWith(PREFIX)) return null;
  try {
    return atob(stored.slice(PREFIX.length));
  } catch {
    return null;
  }
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasStoredApiKey(): boolean {
  return retrieveApiKey() !== null;
}
