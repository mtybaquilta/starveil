import { Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { SHIPS, getShipConfig } from '../config/ships'
import { shipBuildTimeSeconds } from '../config/formulas'
import { formatTime } from '../hooks/useConstructionQueue'
import type { GameContext } from '../components/Layout'

export function ShipyardPage() {
  const { buildings, resources, activeShipBuild, startShipBuild, shipFleet, technologies } = useOutletContext<GameContext>()

  const buildingLevels = new Map(buildings.map((b) => [b.building_id, b.level]))
  const shipyardLevel = buildingLevels.get('shipyard') ?? 0

  const techLevels = new Map(technologies.map((t) => [t.tech_id, t.level]))
  const fleetCounts = new Map(shipFleet.map((s) => [s.ship_type, s.count]))

  if (shipyardLevel === 0) {
    return (
      <div>
        <h1 className="text-lg font-bold text-slate-100 mb-1">Shipyard</h1>
        <p className="text-xs text-slate-500 mb-6">Construct and manage your fleet</p>
        <div className="bg-slate-800/30 rounded-xl p-8 border border-dashed border-slate-700/30 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <div className="text-sm font-semibold text-slate-300 mb-1">No Shipyard Built</div>
          <p className="text-xs text-slate-500 mb-4">
            Build a Shipyard to start constructing your fleet.
          </p>
          <Link
            to="/buildings/shipyard"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Go to Shipyard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-100 mb-1">Shipyard</h1>
      <p className="text-xs text-slate-500 mb-6">
        Shipyard Level {shipyardLevel} · Build times reduced by {Math.round((1 - Math.pow(0.9, shipyardLevel)) * 100)}%
      </p>

      <div className="grid grid-cols-3 gap-4">
        {SHIPS.map((ship) => {
          const shipyardLocked = ship.requiredShipyardLevel > shipyardLevel
          const techLocked = ship.requiredTech
            ? (techLevels.get(ship.requiredTech.techId) ?? 0) < ship.requiredTech.level
            : false
          const isLocked = shipyardLocked || techLocked
          const lockReason = shipyardLocked
            ? `Shipyard Lv.${ship.requiredShipyardLevel}`
            : techLocked && ship.requiredTech
              ? `${ship.requiredTech.techId.replace(/_/g, ' ')} Lv.${ship.requiredTech.level}`
              : undefined
          const canAfford = resources.metal >= ship.cost.metal && resources.gas >= ship.cost.gas
          const queueFull = activeShipBuild !== null
          const canBuild = !isLocked && !queueFull && canAfford
          const buildTime = shipBuildTimeSeconds(ship.baseBuildTimeSeconds, shipyardLevel)
          const fleetCount = fleetCounts.get(ship.id) ?? 0

          return (
            <ShipCard
              key={ship.id}
              ship={ship}
              isLocked={isLocked}
              lockReason={lockReason}
              canBuild={canBuild}
              queueFull={queueFull}
              canAfford={canAfford}
              buildTime={buildTime}
              fleetCount={fleetCount}
              metal={resources.metal}
              gas={resources.gas}
              onBuild={() => startShipBuild(ship.id, 1)}
            />
          )
        })}
      </div>
    </div>
  )
}

function ShipCard({
  ship,
  isLocked,
  lockReason,
  canBuild,
  queueFull,
  canAfford,
  buildTime,
  fleetCount,
  metal,
  gas,
  onBuild,
}: {
  ship: ReturnType<typeof getShipConfig>
  isLocked: boolean
  lockReason?: string
  canBuild: boolean
  queueFull: boolean
  canAfford: boolean
  buildTime: number
  fleetCount: number
  metal: number
  gas: number
  onBuild: () => Promise<void> | void
}) {
  async function handleBuild() {
    try {
      await onBuild()
    } catch (err) {
      console.error('Failed to build ship:', err)
    }
  }

  if (isLocked) {
    return (
      <div className="p-4 bg-slate-800/20 rounded-xl border border-dashed border-slate-700/30">
        <span className="text-4xl opacity-30">{ship.icon}</span>
        <div className="text-xs font-semibold text-slate-600 mb-1 mt-1">{ship.name}</div>
        <div className="text-[10px] text-slate-700">Requires {lockReason}</div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/10">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-4xl">{ship.icon}</span>
        <div>
          <div className="text-xs font-semibold text-slate-200">{ship.name}</div>
          <div className="text-[10px] text-slate-500">Fleet: {fleetCount}</div>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">{ship.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-1 mb-3">
        <StatPill label="Speed" value={ship.stats.speed} />
        <StatPill label="Cargo" value={ship.stats.cargoCapacity.toLocaleString()} />
        <StatPill label="Attack" value={ship.stats.attackPower} />
        <StatPill label="Defense" value={ship.stats.defenseRating} />
      </div>

      {/* Cost */}
      <div className="flex gap-2 mb-3">
        <CostBadge color="bg-orange-400" label="Metal" cost={ship.cost.metal} have={metal} />
        {ship.cost.gas > 0 && (
          <CostBadge color="bg-violet-400" label="Gas" cost={ship.cost.gas} have={gas} />
        )}
      </div>

      <div className="text-[10px] text-slate-500 mb-3">
        Build time: {formatTime(buildTime * 1000)}
      </div>

      <button
        onClick={handleBuild}
        disabled={!canBuild}
        className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
      >
        {queueFull ? 'Queue Full' : !canAfford ? 'Insufficient Resources' : 'Build →'}
      </button>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 bg-slate-900/50 rounded text-[10px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 font-medium">{value}</span>
    </div>
  )
}

function CostBadge({ color, label, cost, have }: { color: string; label: string; cost: number; have: number }) {
  const canAfford = have >= cost
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/50 text-[10px] flex-1`}>
      <div className={`w-1.5 h-1.5 rounded-sm ${color}`} />
      <span className={canAfford ? 'text-slate-300' : 'text-red-400'}>{cost.toLocaleString()}</span>
    </div>
  )
}
