import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/',         label: 'Home',     color: '#5EEAD4' },
  { to: '/tasks',    label: 'Tasks',    color: '#93C5FD' },
  { to: '/asks',     label: 'Asks',     color: '#A78BAA' },
  { to: '/chat',     label: 'Chat',     color: '#93C5FD' },
  { to: '/settings', label: 'Settings', color: '#F9A8D4' },
]

export default function BottomNav({ asksWaiting = false }: { asksWaiting?: boolean }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-cols-5" style={{ gap: 0 }}>
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className="relative grid place-items-center font-sans text-[13px] font-semibold uppercase text-nav-text transition"
          style={({ isActive }) => ({
            backgroundColor: t.color,
            filter: isActive ? 'brightness(0.9)' : 'none',
            borderTop: isActive ? '2px solid #fff' : '2px solid transparent',
          })}
        >
          {t.label}
          {t.label === 'Asks' && asksWaiting && (
            <span className="absolute right-[22%] top-3 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white/70" />
          )}
        </NavLink>
      ))}
    </nav>
  )
}
