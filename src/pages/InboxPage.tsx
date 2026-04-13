import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GameContext } from '../components/Layout'
import type { Mission, MissionResult } from '../hooks/usePlanet'

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function MissionTypeLabel({ type }: { type: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    mining:  { label: 'Mining',  color: 'text-amber-400' },
    raid:    { label: 'Raid',    color: 'text-red-400' },
    salvage: { label: 'Salvage', color: 'text-cyan-400' },
  }
  const { label, color } = labels[type] ?? { label: type, color: 'text-slate-400' }
  return <span className={`font-medium ${color}`}>{label}</span>
}

function MissionReport({ mission, onDismiss }: { mission: Mission; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const result = mission.result as MissionResult | null

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MissionTypeLabel type={mission.mission_type} />
            <span className="text-xs text-slate-400">→ {mission.target_name}</span>
          </div>
          <div className="flex items-center gap-3">
            {result?.rewards && (
              <span className="text-[10px] text-slate-500">
                +{result.rewards.metal ?? 0} metal · +{result.rewards.gas ?? 0} gas
              </span>
            )}
            <span className="text-[10px] text-slate-600">{formatTimestamp(mission.returns_at)}</span>
            <span className="text-slate-600 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {expanded && result && (
        <div className="px-4 pb-4 border-t border-slate-800/30 pt-3 space-y-3">
          {/* Rewards */}
          {result.rewards && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Resources Recovered</div>
              <div className="flex gap-4 text-xs">
                <span className="text-amber-400">⚙️ {(result.rewards.metal ?? 0).toLocaleString()} metal</span>
                <span className="text-blue-400">💨 {(result.rewards.gas ?? 0).toLocaleString()} gas</span>
              </div>
            </div>
          )}

          {/* Ships lost */}
          {result.ships_lost && Object.keys(result.ships_lost).length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wider">Ships Lost</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.ships_lost).map(([type, count]) => (
                  count > 0 && (
                    <span key={type} className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                      {count}× {type.replace(/_/g, ' ')}
                    </span>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Combat log summary */}
          {result.combat_log && Array.isArray(result.combat_log) && result.combat_log.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Combat — {result.combat_log.length} rounds
              </div>
              <div className="text-[10px] text-slate-500">
                {result.encounter_type === 'raid'
                  ? result.ships_lost && Object.values(result.ships_lost as Record<string, number>).reduce((a, b) => a + b, 0) === 0
                    ? 'Victory — no losses.'
                    : 'Victory — with losses.'
                  : 'Defeated — fleet retreated.'}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-[10px] text-slate-600">
              Dispatched {formatTimestamp(mission.dispatched_at)} · Returned {formatTimestamp(mission.returns_at)}
            </div>
            <button
              onClick={() => onDismiss(mission.id)}
              className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function InboxPage() {
  const { completedMissions: rawCompleted, refetch } = useOutletContext<GameContext>()

  const completedMissions = rawCompleted
    .filter((m) => m.result)
    .sort((a, b) => new Date(b.returns_at).getTime() - new Date(a.returns_at).getTime())

  const handleDismiss = async (id: string) => {
    await supabase.from('missions').delete().eq('id', id)
    await refetch()
  }

  const handleClearAll = async () => {
    const ids = completedMissions.map((m) => m.id)
    await supabase.from('missions').delete().in('id', ids)
    await refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Inbox</h1>
          <p className="text-xs text-slate-500 mt-0.5">Detailed mission reports</p>
        </div>
        {completedMissions.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {completedMissions.length === 0 ? (
        <div className="bg-slate-900/30 border border-dashed border-slate-800/40 rounded-lg p-8 text-center">
          <div className="text-3xl mb-2">📬</div>
          <div className="text-sm text-slate-500">No mission reports yet.</div>
          <div className="text-xs text-slate-600 mt-1">Complete a mission to see the detailed report here.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {completedMissions.map((mission) => (
            <MissionReport key={mission.id} mission={mission} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  )
}
