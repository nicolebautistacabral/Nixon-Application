export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="select-none">
      <p className="font-sans text-[10px] sm:text-xs uppercase tracking-[0.2em] opacity-90 drop-shadow">
        ✿ Nicole's Polymath Assistant ✿
      </p>
      <h1
        className={`font-cursive leading-none drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)] ${
          compact ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-7xl'
        }`}
      >
        Nixon
      </h1>
    </div>
  )
}
