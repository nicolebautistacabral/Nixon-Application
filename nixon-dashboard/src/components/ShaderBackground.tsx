import { useEffect, useRef } from 'react'

/**
 * Full-viewport animated gradient, ~30s loop, with a little mouse parallax.
 * Hand-rolled in CSS rather than pulled from a shader package: it is a few
 * hundred bytes, never blocks first paint, and cannot break the whole page if
 * a dependency changes. Stops match the spec exactly.
 */
export default function ShaderBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2
        const y = (e.clientY / window.innerHeight - 0.5) * 2
        ref.current?.style.setProperty('--px', `${x * 3}%`)
        ref.current?.style.setProperty('--py', `${y * 3}%`)
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(frame) }
  }, [])

  return (
    <div ref={ref} aria-hidden className="nixon-bg">
      <span className="nixon-blob nixon-blob-1" />
      <span className="nixon-blob nixon-blob-2" />
      <span className="nixon-blob nixon-blob-3" />
    </div>
  )
}
