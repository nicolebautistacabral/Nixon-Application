import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import Login from '../screens/Login'

/** Nothing renders until we know who this is. The anon key is public, so the
 *  real protection is the row-level security policy, not this component. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </div>
    )
  }
  return session ? <>{children}</> : <Login />
}
