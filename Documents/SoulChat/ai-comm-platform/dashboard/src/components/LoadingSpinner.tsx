import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function LoadingSpinner({ className, size = 24 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={cn('animate-spin text-primary-500', className)} />;
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size={32} />
    </div>
  );
}
