import type { ReactNode } from 'react'
import ShaderBackground from './ShaderBackground'
import BottomNav from './BottomNav'

export default function Layout({
  children,
  asksWaiting = false,
}: { children: ReactNode; asksWaiting?: boolean }) {
  return (
    <>
      <ShaderBackground />
      <div className="relative z-10 min-h-screen pb-[88px]">{children}</div>
      <BottomNav asksWaiting={asksWaiting} />
    </>
  )
}
