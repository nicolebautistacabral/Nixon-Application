import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import type { Mesh, MeshStandardMaterial } from 'three'

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The glow is emissive material plus a CSS halo behind the canvas, not a
 * postprocessing Bloom pass. Bloom rendered an opaque backing square over the
 * gradient and washed the geometry into a flat disc; this keeps the neon look,
 * keeps the canvas transparent, and drops a fragile dependency.
 */
function Core({ pulsing }: { pulsing: boolean }) {
  const solid = useRef<Mesh<never, MeshStandardMaterial>>(null)
  const wire = useRef<Mesh>(null)
  const t = useRef(0)
  const still = useMemo(reduced, [])

  useFrame((_, delta) => {
    if (!still) {
      if (solid.current) solid.current.rotation.y += delta * 0.15 // ~40s a turn
      if (wire.current) {
        wire.current.rotation.y -= delta * 0.09 // counter-rotates, so it reads as depth
        wire.current.rotation.x += delta * 0.03
      }
    }
    if (pulsing && solid.current) {
      t.current += delta
      // 2s cycle while Nixon is waiting on her
      solid.current.material.emissiveIntensity = 0.45 + Math.sin(t.current * Math.PI) * 0.25
    }
  })

  return (
    <group>
      <mesh ref={solid}>
        <icosahedronGeometry args={[1.2, 3]} />
        <meshStandardMaterial
          // metalness stays low: with no environment map a metallic surface has
          // nothing to reflect and renders almost black.
          color="#22D3EE" emissive="#EC4899" emissiveIntensity={0.45}
          roughness={0.35} metalness={0.25}
        />
      </mesh>
      <mesh ref={wire} scale={1.28}>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshBasicMaterial color="#67E8F9" wireframe transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

export default function NeonBrain({ pulsing = false }: { pulsing?: boolean }) {
  const still = useMemo(reduced, [])

  return (
    <div className="pointer-events-none relative" style={{ width: '100%', aspectRatio: '1' }} aria-hidden>
      {/* the halo that bloom used to provide */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(236,72,153,0.55) 0%, rgba(168,85,247,0.30) 38%, transparent 68%)',
          filter: 'blur(26px)',
        }}
      />
      <Canvas
        className="relative"
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => gl.setClearAlpha(0)}
        fallback={null}
      >
        <ambientLight intensity={0.75} color="#A5F3FC" />
        <pointLight position={[3, 2, 4]} intensity={60} color="#F472B6" />
        <pointLight position={[-3, -1, 2]} intensity={55} color="#22D3EE" />
        <Core pulsing={pulsing} />
        {!still && <Sparkles count={40} scale={4} size={2} speed={0.3} color="#EC4899" />}
      </Canvas>
    </div>
  )
}
