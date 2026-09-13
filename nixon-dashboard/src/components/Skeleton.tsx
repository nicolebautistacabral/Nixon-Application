export function SkeletonLine({ w = '100%' }: { w?: string }) {
  return <div className="h-4 animate-pulse rounded bg-white/25" style={{ width: w }} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-md">
      <div className="space-y-3">
        <SkeletonLine w="45%" />
        <SkeletonLine w="85%" />
        <SkeletonLine w="30%" />
      </div>
    </div>
  )
}

export function SkeletonList({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: n }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
