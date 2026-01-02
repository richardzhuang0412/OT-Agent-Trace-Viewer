import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useApiKeyConfig } from '@/hooks/useApiKeyConfig';

interface ApiKeyConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ApiKeyConfigModal({ open, onOpenChange, onSuccess }: ApiKeyConfigModalProps) {
  const [apiKey, setApiKey] = useState('');
  const { configureKey } = useApiKeyConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      return;
    }

    try {
      await configureKey.mutateAsync({ apiKey: apiKey.trim() });
      setApiKey('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the mutation state
      console.error('Failed to configure API key:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !configureKey.isPending) {
      // Reset state when closing
      setApiKey('');
      configureKey.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure OpenAI API Key</DialogTitle>
          <DialogDescription>
            Your API key is stored securely in your session and expires after 24 hours. It is never shared with other users.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={configureKey.isPending}
                autoComplete="off"
              />
              <p className="text-sm text-muted-foreground">
                OpenAI API keys start with "sk-"
              </p>
            </div>

            {configureKey.isError && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{configureKey.error?.message || 'Failed to configure API key'}</span>
              </div>
            )}

            {configureKey.isSuccess && (
              <div className="flex items-start gap-2 rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-500">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>API key configured successfully!</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={configureKey.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={configureKey.isPending || !apiKey.trim()}>
              {configureKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {configureKey.isPending ? 'Validating...' : 'Validate & Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
