'use client';

import { Inbox } from 'lucide-react';
import { Card, Skeleton } from '../../screener/detail/components/ui';

export function SignalCardSkeleton() {
  return (
    <Card as="div" className="space-y-4 p-4">
      <div className="flex justify-between">
        <div className="space-y-1.5"><Skeleton className="h-5 w-24" /><Skeleton className="h-3 w-36" /></div>
        <div className="space-y-1.5"><Skeleton className="ml-auto h-5 w-16" /><Skeleton className="ml-auto h-3 w-10" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      <Skeleton className="h-16" />
      <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>
      <div className="space-y-1.5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-3.5 w-3/4" />)}</div>
    </Card>
  );
}

export function SignalTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card as="div" className="divide-y divide-(--sv-border)">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3.5">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="hidden h-5 w-24 sm:block" />
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </Card>
  );
}

export function SignalEmptyState({ title, hint, action }: { title: string; hint: string; action?: { label: string; onClick: () => void } }) {
  return (
    <Card as="div" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-(--sv-bg) text-(--sv-muted)">
        <Inbox className="size-6" strokeWidth={1.75} />
      </span>
      <p className="font-semibold text-(--sv-text)">{title}</p>
      <p className="max-w-sm text-sm text-(--sv-muted)">{hint}</p>
      {action && (
        <button type="button" onClick={action.onClick} className="mt-2 text-sm font-medium text-(--sv-primary) hover:underline">
          {action.label}
        </button>
      )}
    </Card>
  );
}
