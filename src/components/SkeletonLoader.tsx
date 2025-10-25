// src/components/SkeletonLoader.tsx
// Reusable skeleton loading components for better UX during data fetching

'use client'

import React from 'react'

/**
 * Base skeleton pulse animation
 */
const SkeletonPulse = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
)

/**
 * Skeleton for StudentCard component
 */
export function StudentCardSkeleton() {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 flex-1">
          <SkeletonPulse className="w-8 h-8 rounded-full" />
          <div className="flex-1">
            <SkeletonPulse className="h-5 w-32 mb-2" />
            <SkeletonPulse className="h-4 w-24" />
          </div>
        </div>
        <SkeletonPulse className="w-20 h-6 rounded-full" />
      </div>
      <div className="flex gap-2 mt-3">
        <SkeletonPulse className="h-8 flex-1" />
        <SkeletonPulse className="h-8 w-8" />
        <SkeletonPulse className="h-8 w-8" />
      </div>
    </div>
  )
}

/**
 * Skeleton for GroupCard component
 */
export function GroupCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg p-4 border-2 border-purple-500/50">
      <div className="flex items-center justify-between mb-3">
        <SkeletonPulse className="h-6 w-32" />
        <SkeletonPulse className="w-8 h-8 rounded" />
      </div>
      <div className="space-y-2">
        <SkeletonPulse className="h-16 w-full rounded-lg" />
        <SkeletonPulse className="h-16 w-full rounded-lg" />
      </div>
      <SkeletonPulse className="h-10 w-full mt-4 rounded-lg" />
    </div>
  )
}

/**
 * Skeleton for LoadBuilderCard component
 */
export function LoadBuilderCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <SkeletonPulse className="w-16 h-16 rounded-lg" />
          <div>
            <SkeletonPulse className="h-6 w-24 mb-2" />
            <SkeletonPulse className="h-4 w-32" />
          </div>
        </div>
        <SkeletonPulse className="w-24 h-10 rounded-lg" />
      </div>

      <div className="space-y-3 mb-4">
        <SkeletonPulse className="h-12 w-full rounded-lg" />
        <SkeletonPulse className="h-12 w-full rounded-lg" />
        <SkeletonPulse className="h-12 w-full rounded-lg" />
      </div>

      <div className="flex gap-2">
        <SkeletonPulse className="h-10 flex-1 rounded-lg" />
        <SkeletonPulse className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Skeleton for InstructorCard component
 */
export function InstructorCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <SkeletonPulse className="w-12 h-12 rounded-full" />
          <div className="flex-1">
            <SkeletonPulse className="h-5 w-28 mb-2" />
            <SkeletonPulse className="h-4 w-20" />
          </div>
        </div>
        <SkeletonPulse className="w-16 h-8 rounded-full" />
      </div>

      <div className="flex gap-2">
        <SkeletonPulse className="h-6 w-16 rounded-full" />
        <SkeletonPulse className="h-6 w-16 rounded-full" />
        <SkeletonPulse className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

/**
 * Generic list skeleton with configurable count
 */
export function SkeletonList({
  count = 3,
  Component = StudentCardSkeleton
}: {
  count?: number
  Component?: React.ComponentType
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </div>
  )
}

/**
 * Grid skeleton for cards
 */
export function SkeletonGrid({
  count = 6,
  columns = 3,
  Component = StudentCardSkeleton
}: {
  count?: number
  columns?: number
  Component?: React.ComponentType
}) {
  return (
    <div className={`grid gap-4 ${
      columns === 2 ? 'grid-cols-1 lg:grid-cols-2' :
      columns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
      columns === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
      'grid-cols-1'
    }`}>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </div>
  )
}

/**
 * Page skeleton with header
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <SkeletonPulse className="h-10 w-48 mb-6" />
        <SkeletonList count={5} />
      </div>
    </div>
  )
}
