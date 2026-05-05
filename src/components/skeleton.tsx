import { cn } from '@/lib/utils'

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_ease-in-out_infinite] rounded-xl',
        className
      )}
    />
  )
}

export function SkeletonBalance() {
  return (
    <div className="hero-gradient px-5 pt-14 pb-8 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full" />
          <div className="space-y-1.5">
            <div className="w-20 h-2.5 bg-white/20 rounded-full" />
            <div className="w-28 h-3.5 bg-white/20 rounded-full" />
          </div>
        </div>
        <div className="w-9 h-9 bg-white/15 rounded-full" />
      </div>
      <div className="w-20 h-3 bg-white/20 rounded-full mb-2" />
      <div className="w-48 h-12 bg-white/20 rounded-2xl mb-3" />
      <div className="w-28 h-7 bg-white/15 rounded-full" />
    </div>
  )
}

export function SkeletonListItem({ showBorder = true }: { showBorder?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${showBorder ? 'border-b border-border' : ''}`}>
      <Shimmer className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-3.5 w-3/4" />
        <Shimmer className="h-2.5 w-1/2" />
      </div>
      <Shimmer className="h-3.5 w-12" />
    </div>
  )
}

export function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListItem key={i} showBorder={i < rows - 1} />
      ))}
    </div>
  )
}

export function SkeletonPendingRequest() {
  return (
    <div className="card px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-2">
          <Shimmer className="h-3.5 w-32" />
          <Shimmer className="h-2.5 w-24" />
        </div>
        <Shimmer className="h-7 w-16" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="flex-1 h-11 rounded-2xl" />
        <Shimmer className="flex-1 h-11 rounded-2xl" />
      </div>
    </div>
  )
}
