import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { SIZE_PX, type AgentDef } from '../lib/agents'

type Props = {
  agent: AgentDef
  openCount: number
  hasOverdue: boolean
  /** absolute on desktop, plain grid item on mobile */
  positioned?: boolean
}

export default function AgentBubble({ agent, openCount, hasOverdue, positioned = false }: Props) {
  const px = SIZE_PX[agent.size]

  return (
    <motion.div
      className={positioned ? 'absolute' : ''}
      style={positioned ? { ...agent.pos, width: px, height: px } : undefined}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Link
        to={`/agent/${agent.key}`}
        aria-label={`${agent.name}, ${agent.role}, ${openCount} open ${openCount === 1 ? 'task' : 'tasks'}`}
        className="group relative grid place-items-center rounded-full transition-transform duration-200 hover:scale-[1.08] focus-visible:scale-[1.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        style={{
          width: positioned ? px : '100%',
          aspectRatio: '1',
          background:
            'linear-gradient(to bottom right, rgba(255,255,255,0.25), rgba(255,255,255,0.10) 45%, rgba(255,255,255,0.05))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.30)',
          boxShadow: `inset 0 1px 12px rgba(255,255,255,0.35), 0 0 28px ${agent.color}66`,
        }}
      >
        {/* the little highlight that makes it read as a sphere */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[18%] top-[14%] h-[22%] w-[34%] rounded-[50%] bg-white/50 blur-[6px]"
        />
        <span className="font-sans font-medium tracking-[0.1em] text-sm drop-shadow">
          {agent.name.toUpperCase()}
        </span>

        {openCount > 0 && (
          <span
            className={`absolute -right-1 -top-1 grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold shadow-lg ${
              hasOverdue ? 'bg-red-500 text-white' : 'bg-white text-nav-text'
            }`}
          >
            {openCount}
          </span>
        )}
      </Link>
    </motion.div>
  )
}
