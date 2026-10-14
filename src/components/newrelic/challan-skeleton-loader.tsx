'use client';

import React from 'react';

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:400%_100%] animate-[shimmer_1.4s_ease-in-out_infinite] rounded-lg ${className ?? ''}`}
    />
  );
}

function ChallanCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-l-4 border-l-blue-200 border-gray-200/90 p-4 shadow-2xs space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShimmerBlock className="w-4 h-4 rounded" />
          <div className="space-y-1.5">
            <ShimmerBlock className="w-28 h-4" />
            <ShimmerBlock className="w-20 h-3" />
          </div>
        </div>
        <ShimmerBlock className="w-24 h-6 rounded-full" />
      </div>

      {/* Items preview block */}
      <div className="bg-gray-50/90 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <ShimmerBlock className="w-24 h-3" />
          <ShimmerBlock className="w-16 h-3" />
        </div>
        <ShimmerBlock className="w-full h-3" />
        <ShimmerBlock className="w-3/4 h-3" />
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-1.5 pt-1">
        <ShimmerBlock className="w-16 h-9 rounded-xl" />
        <ShimmerBlock className="w-20 h-9 rounded-xl" />
        <ShimmerBlock className="w-9 h-9 rounded-xl" />
        <ShimmerBlock className="w-24 h-9 rounded-xl" />
        <ShimmerBlock className="ml-auto w-9 h-9 rounded-xl" />
      </div>
    </div>
  );
}

export function ChallanSkeletonLoader({ count = 4 }: { count?: number }) {
  return (
    <>
      {/* Mobile skeletons */}
      <div className="block sm:hidden bg-gray-50/50 p-2.5 space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <ChallanCardSkeleton key={i} />
        ))}
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table header shimmer */}
        <div className="border-b border-gray-100 px-6 py-4">
          <ShimmerBlock className="w-40 h-4" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <ShimmerBlock className="w-4 h-4 rounded" />
              <ShimmerBlock className="w-28 h-4" />
              <ShimmerBlock className="w-24 h-4" />
              <ShimmerBlock className="w-20 h-6 rounded-full" />
              <ShimmerBlock className="w-16 h-4" />
              <div className="ml-auto flex gap-2">
                <ShimmerBlock className="w-8 h-8 rounded-lg" />
                <ShimmerBlock className="w-8 h-8 rounded-lg" />
                <ShimmerBlock className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
