import { useOutletContext } from 'react-router-dom'
import { SHIPS } from '../config/ships'
import { formatTime } from '../hooks/useConstructionQueue'
import type { GameContext } from '../components/Layout'

export function FleetPage() {
  const { shipFleet, activeShipBuild, shipTimeRemaining, activeMissions } = useOutletContext<GameContext>()

  const fleetCounts = new Map(shipFleet.map((s) => [s.ship_type, s.count]))
  const totalShips = shipFleet.reduce((sum, s) => sum + s.count, 0)

  // Compute deployed ships from active missions
  const deployedCounts = new Map<string, number>()
  for (const m of activeMissions) {
    for (const [type, count] of Object.entries(m.fleet)) {
      deployedCounts.set(type, (deployedCounts.get(type) || 0) + count)
    }
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-100 mb-1">Fleet</h1>
      <p className="text-xs text-slate-500 mb-6">
        {totalShips === 0 ? 'No ships in your fleet yet' : `${totalShips} ship${totalShips !== 1 ? 's' : ''} at this planet`}
      </p>

      {/* Active Construction */}
      {activeShipBuild && (
        <div className="bg-slate-800/30 rounded-xl p-5 border border-sky-700/20 mb-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Under Construction</h2>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{SHIPS.find((s) => s.id === activeShipBuild.ship_type)?.icon}</span>
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-200">
                {SHIPS.find((s) => s.id === activeShipBuild.ship_type)?.name} ×{activeShipBuild.quantity}
              </div>
              <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <ProgressBar startedAt={activeShipBuild.started_at} completesAt={activeShipBuild.completes_at} timeRemaining={shipTimeRemaining} />
              </div>
            </div>
            <div className="text-sm font-bold text-sky-400">
              {shipTimeRemaining !== null ? formatTime(shipTimeRemaining) : '...'}
            </div>
          </div>
        </div>
      )}

      {/* Fleet Roster */}
      <div className="grid grid-cols-3 gap-4">
        {SHIPS.map((ship) => {
          const count = fleetCounts.get(ship.id) ?? 0
          const deployed = deployedCounts.get(ship.id) ?? 0
          const available = count - deployed
          return (
            <FleetCard
              key={ship.id}
              ship={ship}
              count={count}
              available={available}
              deployed={deployed}
            />
          )
        })}
      </div>
    </div>
  )
}

function FleetCard({
  ship,
  count,
  available,
  deployed,
}: {
  ship: (typeof SHIPS)[number]
  count: number
  available: number
  deployed: number
}) {
  return (
    <div className={`bg-slate-800/40 rounded-xl border border-slate-700/20 overflow-hidden flex flex-col transition-opacity ${count === 0 ? 'opacity-40' : ''}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="text-sm font-bold text-slate-100">{ship.name}</div>
        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed flex-1">{ship.description}</div>
      </div>

      {/* Full-width image */}
      <img src={ship.image} alt={ship.name} className="w-full h-36 object-cover" />

      {/* Counts */}
      <div className="px-4 py-3 flex items-center justify-between mt-auto">
        <div>
          <div className={`text-2xl font-bold ${count > 0 ? 'text-slate-100' : 'text-slate-600'}`}>{available}</div>
          <div className="text-[10px] text-slate-500">available</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-400">{count}</div>
          <div className="text-[10px] text-slate-500">total</div>
          {deployed > 0 && (
            <div className="text-[10px] text-indigo-400 mt-0.5">{deployed} on mission</div>
          )}
        </div>
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
