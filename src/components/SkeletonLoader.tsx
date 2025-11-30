import React from 'react';

interface SkeletonLoaderProps {
  rows?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 bg-slate-700 rounded flex-1" />
          <div className="h-4 bg-slate-700 rounded w-32" />
          <div className="h-4 bg-slate-700 rounded w-24" />
          <div className="h-4 bg-slate-700 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }: SkeletonLoaderProps) {
  return (
    <div className={`card p-6 animate-pulse ${className}`}>
      <div className="h-4 bg-slate-700 rounded w-3/4 mb-4" />
      <div className="h-4 bg-slate-700 rounded w-1/2 mb-2" />
      <div className="h-4 bg-slate-700 rounded w-2/3" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-slate-700 rounded-lg" />
        <div className="h-5 w-12 bg-slate-700 rounded" />
      </div>
      <div className="h-8 bg-slate-700 rounded w-20 mb-2" />
      <div className="h-4 bg-slate-700 rounded w-32" />
    </div>
  );
}

