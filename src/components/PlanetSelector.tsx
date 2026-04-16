import { useState, useRef, useEffect } from 'react'
import type { PlanetSummary } from '../hooks/usePlanets'

type Props = {
  planets: PlanetSummary[]
  selectedPlanetId: string | null
  onSelect: (id: string) => void
}

export function PlanetSelector({ planets, selectedPlanetId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const current = planets.find((p) => p.id === selectedPlanetId)

  return (
    <div ref={ref} className="relative mr-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-xs text-slate-300 hover:bg-slate-700/60 transition-colors cursor-pointer"
      >
        <span className="text-slate-500">🌍</span>
        <span className="font-medium">{current?.name ?? 'Select'}</span>
        <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-slate-900 border border-slate-700/40 rounded-lg shadow-xl min-w-[200px] py-1">
          {planets.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center justify-between ${
                p.id === selectedPlanetId ? 'text-cyan-400' : 'text-slate-300'
              }`}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-slate-500 text-[10px]">{p.coordinates}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
