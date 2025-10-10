import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, ArrowLeft, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { HfDataset } from '@shared/schema';

export default function DatasetsPage() {
  const { data: datasets, isLoading } = useQuery<HfDataset[]>({
    queryKey: ['/api/hf/datasets'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-foreground dark:text-white mb-2">
            HuggingFace Datasets
          </h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Browse datasets from mlfoundations-dev organization
          </p>
        </div>

        {datasets && datasets.length === 0 && (
          <div className="text-center py-12">
            <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No datasets found</h3>
            <p className="text-muted-foreground">
              No datasets available from mlfoundations-dev
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {datasets?.map((dataset) => (
            <Link key={dataset.id} href={`/datasets/${encodeURIComponent(dataset.id)}`}>
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                data-testid={`card-dataset-${dataset.id}`}
              >
                <CardHeader>
                  <CardTitle className="text-foreground dark:text-white flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    {dataset.id.split('/').pop()}
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">
                    {dataset.id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground dark:text-gray-400">
                    {dataset.downloads !== undefined && (
                      <span data-testid={`text-downloads-${dataset.id}`}>
                        {dataset.downloads.toLocaleString()} downloads
                      </span>
                    )}
                    {dataset.likes !== undefined && (
                      <span data-testid={`text-likes-${dataset.id}`}>
                        {dataset.likes} likes
                      </span>
                    )}
                  </div>
                  {dataset.tags && dataset.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {dataset.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-block px-2 py-1 text-xs rounded-full bg-primary/10 text-primary dark:bg-primary/20"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
