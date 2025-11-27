import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TraceFilterParams } from '@shared/schema';

interface TraceFilterPanelProps {
  filters: Partial<TraceFilterParams>;
  onFilterChange: (filters: Partial<TraceFilterParams>) => void;
  resultsCount?: number;
  isLoading?: boolean;
}

export function TraceFilterPanel({
  filters,
  onFilterChange,
  resultsCount,
  isLoading = false,
}: TraceFilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<Partial<TraceFilterParams>>(filters);

  const handleChange = (field: keyof TraceFilterParams, value: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    setLocalFilters({});
    onFilterChange({});
  };

  return (
    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <CardHeader>
        <CardTitle className="text-lg text-foreground dark:text-white">
          Filter Traces
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="run-id" className="text-sm font-medium text-foreground dark:text-gray-200">
            Run ID
          </Label>
          <Input
            id="run-id"
            placeholder="Filter by run ID..."
            value={localFilters.run_id || ''}
            onChange={(e) => handleChange('run_id', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="model" className="text-sm font-medium text-foreground dark:text-gray-200">
            Model
          </Label>
          <Input
            id="model"
            placeholder="Filter by model..."
            value={localFilters.model || ''}
            onChange={(e) => handleChange('model', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="task" className="text-sm font-medium text-foreground dark:text-gray-200">
            Task
          </Label>
          <Input
            id="task"
            placeholder="Filter by task..."
            value={localFilters.task || ''}
            onChange={(e) => handleChange('task', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="trial-name" className="text-sm font-medium text-foreground dark:text-gray-200">
            Trial Name
          </Label>
          <Input
            id="trial-name"
            placeholder="Filter by trial name..."
            value={localFilters.trial_name || ''}
            onChange={(e) => handleChange('trial_name', e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleApply} disabled={isLoading} className="flex-1">
            {isLoading ? 'Applying...' : 'Apply Filters'}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={isLoading}
            className="flex-1"
          >
            Reset
          </Button>
        </div>

        {resultsCount !== undefined && (
          <div className="text-sm text-muted-foreground dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-800">
            {resultsCount} trace{resultsCount !== 1 ? 's' : ''} found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
