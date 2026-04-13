import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SHIPS } from '../config/ships'
import { formatTime } from '../hooks/useConstructionQueue'
import type { GameContext } from '../components/Layout'

export function FleetPage() {
  const { planet, shipFleet, activeShipBuild, shipBuildQueue, shipTimeRemaining, activeMissions, refetch } = useOutletContext<GameContext>()
  const navigate = useNavigate()

  const fleetCounts = new Map(shipFleet.map((s) => [s.ship_type, s.count]))

  // Compute deployed ships from active missions
  const deployedCounts = new Map<string, number>()
  for (const m of activeMissions) {
    for (const [type, count] of Object.entries(m.fleet)) {
      deployedCounts.set(type, (deployedCounts.get(type) || 0) + count)
    }
  }

  // Compute aggregate fleet power
  const totals = SHIPS.reduce(
    (acc, ship) => {
      const count = fleetCounts.get(ship.id) ?? 0
      acc.attack += count * ship.stats.attackPower
      acc.defense += count * ship.stats.defenseRating
      acc.cargo += count * ship.stats.cargoCapacity
      acc.ships += count
      return acc
    },
    { attack: 0, defense: 0, cargo: 0, ships: 0 }
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-100 mb-1">Fleet</h1>
        <p className="text-xs text-slate-500">Manage your ships, scrap hulls, or deploy to missions</p>
      </div>

      {/* Build Queue */}
      {shipBuildQueue.length > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-5 border border-sky-700/20">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">
            Build Queue {shipBuildQueue.length > 1 && <span className="text-slate-500 font-normal">({shipBuildQueue.length})</span>}
          </h2>
          <div className="space-y-3">
            {shipBuildQueue.map((item, i) => {
              const ship = SHIPS.find((s) => s.id === item.ship_type)
              const isActive = item.completes_at !== null
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-2xl">{ship?.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-200">
                      {ship?.name} ×{item.quantity}
                      {!isActive && <span className="text-slate-500 ml-2">Queued #{i + 1}</span>}
                    </div>
                    {isActive && (
                      <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <ProgressBar startedAt={item.started_at} completesAt={item.completes_at!} timeRemaining={shipTimeRemaining} />
                      </div>
                    )}
                  </div>
                  {isActive ? (
                    <div className="text-sm font-bold text-sky-400">
                      {shipTimeRemaining !== null ? formatTime(shipTimeRemaining) : '...'}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Waiting</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Power Banner */}
      {totals.ships > 0 && (
        <div className="bg-gradient-to-r from-indigo-950/60 to-slate-900/60 rounded-xl p-5 border border-indigo-800/20">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Fleet Power</div>
          <div className="flex gap-8">
            <div>
              <div className="text-xl font-bold text-orange-400">{totals.attack}</div>
              <div className="text-[10px] text-slate-500">Attack</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-400">{totals.defense}</div>
              <div className="text-[10px] text-slate-500">Defense</div>
            </div>
            <div>
              <div className="text-xl font-bold text-purple-400">{totals.cargo.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Cargo</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-400">{totals.ships}</div>
              <div className="text-[10px] text-slate-500">Ships</div>
            </div>
          </div>
        </div>
      )}

      {/* Ship List Rows */}
      <div className="space-y-2">
        {SHIPS.map((ship) => {
          const count = fleetCounts.get(ship.id) ?? 0
          const deployed = deployedCounts.get(ship.id) ?? 0
          const available = count - deployed
          return (
            <ShipRow
              key={ship.id}
              ship={ship}
              count={count}
              available={available}
              deployed={deployed}
              planetId={planet.id}
              onScrap={refetch}
              onDeploy={() => navigate(`/missions?ship=${ship.id}`)}
            />
          )
        })}
      </div>
    </div>
  )
}

function ShipRow({
  ship,
  count,
  available,
  deployed,
  planetId,
  onScrap,
  onDeploy,
}: {
  ship: (typeof SHIPS)[number]
  count: number
  available: number
  deployed: number
  planetId: string
  onScrap: () => Promise<void>
  onDeploy: () => void
}) {
  const [scrapping, setScrapping] = useState(false)

  async function handleScrap() {
    setScrapping(true)
    try {
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'scrap_ship', planetId, shipType: ship.id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      await onScrap()
    } catch (err) {
      console.error('Failed to scrap ship:', err)
    } finally {
      setScrapping(false)
    }
  }

  const canScrap = available > 0
  const canDeploy = available > 0

  return (
    <div className={`bg-slate-800/40 rounded-lg border border-slate-700/20 px-4 py-3 flex items-center gap-4 transition-opacity ${count === 0 ? 'opacity-40' : ''}`}>
      {/* Icon + Name */}
      <div className="flex items-center gap-3 min-w-[160px]">
        <span className="text-2xl">{ship.icon}</span>
        <div>
          <div className="text-sm font-semibold text-slate-200">{ship.name}</div>
          <div className="text-[10px] text-slate-500">
            Spd {ship.stats.speed} · Atk {ship.stats.attackPower} · Def {ship.stats.defenseRating} · Cargo {ship.stats.cargoCapacity.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Count */}
      <div className="text-center min-w-[60px]">
        <div className="text-lg font-bold text-slate-100">
          {available}<span className="text-sm text-slate-500">/{count}</span>
        </div>
        <div className="text-[10px] text-slate-500">
          {deployed > 0 ? (
            <span className="text-indigo-400">{deployed} deployed</span>
          ) : count > 0 ? (
            <span className="text-emerald-500">all home</span>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 min-w-[160px] justify-end">
        <button
          onClick={handleScrap}
          disabled={!canScrap || scrapping}
          className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {scrapping ? 'Scrapping...' : 'Scrap'}
        </button>
        <button
          onClick={onDeploy}
          disabled={!canDeploy}
          className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Deploy →
        </button>
      </div>
    </div>
  )
}

function ProgressBar({ startedAt, completesAt, timeRemaining }: { startedAt: string; completesAt: string; timeRemaining: number | null }) {
  const totalMs = new Date(completesAt).getTime() - new Date(startedAt).getTime()
  const elapsedMs = totalMs - (timeRemaining ?? 0)
  const progress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0
  return (
    <div
      className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 rounded-full transition-all duration-1000"
      style={{ width: `${progress}%` }}
    />
  )
}
