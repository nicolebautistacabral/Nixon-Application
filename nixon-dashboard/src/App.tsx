import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import ShaderBackground from './components/ShaderBackground'
import Home from './screens/Home'
import Tasks from './screens/Tasks'
import Asks from './screens/Asks'
import Chat from './screens/Chat'
import Settings from './screens/Settings'
import AgentDetail from './screens/AgentDetail'
import { getAllTasks, getToday } from './lib/queries'
import { useLive } from './hooks/useLive'
import { asksFrom } from './lib/phase'
import { configError } from './lib/supabase'
import type { DailyState, Task } from './types/db'

function Shell() {
  // One read, shared with the nav, so the Asks dot is live everywhere.
  const tasks = useLive<Task[]>('tasks', getAllTasks, [])
  const state = useLive<DailyState | null>('daily_state', getToday, null)
  const waiting = asksFrom(state.data, tasks.data).length > 0

  return (
    <Layout asksWaiting={waiting}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/asks" element={<Asks />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/agent/:name" element={<AgentDetail />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  )
}

/** A build with no Supabase credentials must say so, not show a blank screen. */
function NotConfigured({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-5 text-center">
      <div className="max-w-md rounded-2xl border border-white/30 bg-white/15 p-6 backdrop-blur-md">
        <h1 className="font-cursive text-4xl">Nixon</h1>
        <p className="mt-3 font-semibold">Not configured yet</p>
        <p className="mt-2 text-sm opacity-90">{message}</p>
      </div>
    </main>
  )
}

export default function App() {
  if (configError) {
    return (
      <>
        <ShaderBackground />
        <div className="relative z-10"><NotConfigured message={configError} /></div>
      </>
    )
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <RequireAuth><Shell /></RequireAuth>
      </AuthProvider>
    </BrowserRouter>
  )
}
