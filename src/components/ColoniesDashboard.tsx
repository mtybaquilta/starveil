import { useEffect, useState } from 'react'
import type { ColonySummary } from '../hooks/useColonySummaries'

type Props = {
  summaries: ColonySummary[]
  selectedPlanetId: string | null
  onSelect: (id: string) => void
  loading: boolean
}

function formatRemaining(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return 'done'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function formatRate(n: number): string {
  return `${Math.round(n).toLocaleString()}/h`
}

function weatherGlyph(type: string | null): string {
  if (!type || type === 'calm_skies') return '🛰 Clear'
  if (type.includes('storm')) return '⚡ Storm'
  if (type.includes('solar')) return '☀ Solar'
  if (type.includes('ion')) return '⚡ Ion'
  return `· ${type.replace(/_/g, ' ')}`
}

function QueueSlot({ label, completesAt, now }: { label: string | null; completesAt: string | null; now: number }) {
  if (!label || !completesAt) {
    return <span className="text-slate-600">(idle)</span>
  }
  return (
    <span>
      <span className="text-slate-300">{label}</span>
      <span className="text-slate-500"> · {formatRemaining(completesAt, now)}</span>
    </span>
  )
}

export function ColoniesDashboard({ summaries, selectedPlanetId, onSelect, loading }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (loading && summaries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/20 bg-slate-800/20 p-4 text-xs text-slate-500">
        Loading colonies…
      </div>
    )
  }
  if (summaries.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-700/20 bg-slate-800/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/20">
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">All Colonies</h2>
        <span className="text-[10px] text-slate-600">{summaries.length} planet{summaries.length !== 1 ? 's' : ''}</span>
      </div>
      <ul>
        {summaries.map((c) => {
          const active = c.id === selectedPlanetId
          const energyPct = Math.round(c.energyRatio * 100)
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${
                  active
                    ? 'bg-indigo-500/10 border-indigo-500'
                    : 'border-transparent hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                    <span className="text-sm font-semibold text-slate-100">{c.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{c.coordinates}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>⚡ {energyPct}%</span>
                    <span>{weatherGlyph(c.weatherType)}</span>
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-6 text-[11px]">
                  <div className="text-slate-400">
                    Metal <span className="text-slate-200">{Math.floor(c.metal).toLocaleString()}</span>
                    <span className="text-slate-600"> / {c.metalStorageCap.toLocaleString()}</span>
                    <span className="text-emerald-400/80"> ↑ {formatRate(c.metalPerHour)}</span>
                  </div>
                  <div className="text-slate-400">
                    Gas <span className="text-slate-200">{Math.floor(c.gas).toLocaleString()}</span>
                    <span className="text-slate-600"> / {c.gasStorageCap.toLocaleString()}</span>
                    <span className="text-cyan-400/80"> ↑ {formatRate(c.gasPerHour)}</span>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-500">
                  <span>
                    🏗{' '}
                    <QueueSlot
                      label={c.construction?.label ?? null}
                      completesAt={c.construction?.completesAt ?? null}
                      now={now}
                    />
                  </span>
                  <span>
                    🚀{' '}
                    <QueueSlot
                      label={c.shipBuild?.label ?? null}
                      completesAt={c.shipBuild?.completesAt ?? null}
                      now={now}
                    />
                  </span>
                  <span>
                    ✈{' '}
                    <span className={c.activeMissions > 0 ? 'text-slate-300' : 'text-slate-600'}>
                      {c.activeMissions > 0 ? `${c.activeMissions} active` : 'No missions'}
                    </span>
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
