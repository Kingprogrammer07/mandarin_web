import { memo } from 'react';
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import { Skeleton } from '@/components/ui/skeleton';

export const PageLoadingFallback = memo(() => (
  <>
    <TopProgressBar />
    <div className="p-4 space-y-3 animate-in fade-in duration-200">
      <Skeleton className="h-12 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-3/4 rounded-2xl" />
    </div>
  </>
));
PageLoadingFallback.displayName = 'PageLoadingFallback';
