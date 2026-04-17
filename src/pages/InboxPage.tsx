import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GameContext } from '../components/Layout'
import type { Mission, MissionResult, PlayerAttack } from '../hooks/usePlanet'

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

function MissionReport({ mission, onDismiss }: { mission: Mission; onDismiss: (id: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [dismissing, setDismissing] = useState(false)
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
              onClick={async () => { setDismissing(true); await onDismiss(mission.id) }}
              disabled={dismissing}
              className="text-[10px] text-slate-600 hover:text-red-400 disabled:opacity-40 transition-colors"
            >
              {dismissing ? 'Dismissing...' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AttackReport({
  attack,
  iAmAttacker,
}: {
  attack: PlayerAttack
  iAmAttacker: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const result = attack.result
  if (!result) return null

  // "Victory" for defender = attacker lost
  const iWon = iAmAttacker ? !!result.victory : !result.victory
  const opponent = iAmAttacker ? result.defender_username : result.attacker_username
  const myLosses = iAmAttacker ? result.attacker_losses : result.defender_losses
  const opponentLosses = iAmAttacker ? result.defender_losses : result.attacker_losses
  const stolen = result.stolen ?? { metal: 0, gas: 0 }

  const resolvedAt = attack.resolved_at ?? attack.dispatched_at

  const summaryColor = iWon ? 'text-green-400' : 'text-red-400'
  const summaryLabel = iWon ? (iAmAttacker ? 'Raid Success' : 'Defense Held') : (iAmAttacker ? 'Raid Failed' : 'Raid Suffered')
  const arrow = iAmAttacker ? '→' : '←'

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${summaryColor}`}>⚔ {summaryLabel}</span>
            <span className="text-xs text-slate-400">{arrow} {opponent ?? 'Unknown'} ({attack.target_coordinates})</span>
          </div>
          <div className="flex items-center gap-3">
            {iAmAttacker && iWon && (
              <span className="text-[10px] text-slate-500">
                +{stolen.metal ?? 0} metal · +{stolen.gas ?? 0} gas
              </span>
            )}
            {!iAmAttacker && result.victory && (
              <span className="text-[10px] text-red-400/80">
                −{stolen.metal ?? 0} metal · −{stolen.gas ?? 0} gas
              </span>
            )}
            <span className="text-[10px] text-slate-600">{formatTimestamp(resolvedAt)}</span>
            <span className="text-slate-600 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/30 pt-3 space-y-3">
          {/* Resources — only when something changed */}
          {result.victory && (stolen.metal > 0 || stolen.gas > 0) && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {iAmAttacker ? 'Plunder' : 'Resources Lost'}
              </div>
              <div className="flex gap-4 text-xs">
                <span className={iAmAttacker ? 'text-amber-400' : 'text-red-400'}>
                  {iAmAttacker ? '+' : '−'}{(stolen.metal ?? 0).toLocaleString()} metal
                </span>
                <span className={iAmAttacker ? 'text-blue-400' : 'text-red-400'}>
                  {iAmAttacker ? '+' : '−'}{(stolen.gas ?? 0).toLocaleString()} gas
                </span>
              </div>
            </div>
          )}

          {/* My losses */}
          {myLosses && Object.keys(myLosses).length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wider">Your Losses</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(myLosses).map(([type, count]) => (
                  count > 0 && (
                    <span key={type} className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                      {count}× {type.replace(/_/g, ' ')}
                    </span>
                  )
                ))}
                {Object.values(myLosses).every((c) => c === 0) && (
                  <span className="text-[10px] text-slate-500">No ships lost.</span>
                )}
              </div>
            </div>
          )}

          {/* Opponent losses */}
          {opponentLosses && Object.keys(opponentLosses).length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Enemy Losses</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(opponentLosses).map(([type, count]) => (
                  count > 0 && (
                    <span key={type} className="text-xs text-slate-300 bg-slate-800/40 px-2 py-0.5 rounded">
                      {count}× {type.replace(/_/g, ' ')}
                    </span>
                  )
                ))}
                {Object.values(opponentLosses).every((c) => c === 0) && (
                  <span className="text-[10px] text-slate-500">Enemy fleet unharmed.</span>
                )}
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-600">
            Dispatched {formatTimestamp(attack.dispatched_at)} · Resolved {formatTimestamp(resolvedAt)}
          </div>
        </div>
      )}
    </div>
  )
}

type InboxItem =
  | { kind: 'mission'; at: number; mission: Mission }
  | { kind: 'attack'; at: number; attack: PlayerAttack; iAmAttacker: boolean }

export function InboxPage() {
  const { completedMissions: rawCompleted, resolvedAttacks, planets, refetch } = useOutletContext<GameContext>()

  const [clearing, setClearing] = useState(false)

  const myPlanetIds = new Set(planets.map((p) => p.id))

  const missionItems: InboxItem[] = rawCompleted
    .filter((m) => m.result)
    .map((mission) => ({
      kind: 'mission' as const,
      at: new Date(mission.returns_at).getTime(),
      mission,
    }))

  const attackItems: InboxItem[] = resolvedAttacks
    .filter((a) => a.result)
    .map((attack) => ({
      kind: 'attack' as const,
      at: new Date(attack.resolved_at ?? attack.dispatched_at).getTime(),
      attack,
      iAmAttacker: myPlanetIds.has(attack.attacker_planet_id),
    }))

  const items = [...missionItems, ...attackItems].sort((a, b) => b.at - a.at)

  const handleDismissMission = async (id: string) => {
    await supabase.from('missions').delete().eq('id', id)
    await refetch()
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      const missionIds = missionItems.map((i) => (i as { mission: Mission }).mission.id)
      if (missionIds.length > 0) {
        await supabase.from('missions').delete().in('id', missionIds)
      }
      await refetch()
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Inbox</h1>
          <p className="text-xs text-slate-500 mt-0.5">Mission and battle reports</p>
        </div>
        {missionItems.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="text-[11px] text-slate-500 hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            {clearing ? 'Clearing...' : 'Clear missions'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-slate-900/30 border border-dashed border-slate-800/40 rounded-lg p-8 text-center">
          <div className="text-3xl mb-2">📬</div>
          <div className="text-sm text-slate-500">No reports yet.</div>
          <div className="text-xs text-slate-600 mt-1">Complete a mission or survive a raid to see reports here.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) =>
            item.kind === 'mission' ? (
              <MissionReport key={`m-${item.mission.id}`} mission={item.mission} onDismiss={handleDismissMission} />
            ) : (
              <AttackReport key={`a-${item.attack.id}`} attack={item.attack} iAmAttacker={item.iAmAttacker} />
            )
          )}
        </div>
      )}
    </div>
  )
}
