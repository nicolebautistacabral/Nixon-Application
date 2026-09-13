import { Component, Suspense, lazy, type ReactNode } from 'react'

const NeonBrain = lazy(() => import('./NeonBrain'))

/** A decorative orb that stands in whenever WebGL or the 3D stack fails. */
export function BrainOrb() {
  return (
    <div
      aria-hidden
      className="rounded-full opacity-80"
      style={{
        width: '100%', aspectRatio: '1',
        background: 'radial-gradient(circle at 40% 35%, #22D3EE, #EC4899 70%, transparent 72%)',
        filter: 'blur(8px)',
      }}
    />
  )
}

/**
 * The brain is decoration. A failure inside it — a driver without WebGL, a
 * library mismatch, a lost context — must never take the page with it, so it
 * gets its own boundary rather than sharing the screen's.
 */
class Boundary extends Component<{ children: ReactNode }, { dead: boolean }> {
  state = { dead: false }
  static getDerivedStateFromError() { return { dead: true } }
  componentDidCatch(error: unknown) { console.warn('3D brain failed, showing the orb instead', error) }
  render() { return this.state.dead ? <BrainOrb /> : this.props.children }
}

export default function SafeBrain({ pulsing }: { pulsing: boolean }) {
  return (
    <Boundary>
      <Suspense fallback={<BrainOrb />}>
        <NeonBrain pulsing={pulsing} />
      </Suspense>
    </Boundary>
  )
}
