import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { SHIPS, getShipConfig } from '../config/ships'
import { shipBuildTimeSeconds } from '../config/formulas'
import { formatTime } from '../hooks/useConstructionQueue'
import { getTechBonuses } from '../lib/techBonuses'
import type { GameContext } from '../components/Layout'

export function ShipyardPage() {
  const { buildings, resources, activeShipBuild, shipBuildQueue, startShipBuild, shipFleet, technologies } = useOutletContext<GameContext>()

  const buildingLevels = new Map(buildings.map((b) => [b.building_id, b.level]))
  const shipyardLevel = buildingLevels.get('shipyard') ?? 0

  const techLevels = new Map(technologies.map((t) => [t.tech_id, t.level]))
  const techBonuses = getTechBonuses(technologies)
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

      <div className="grid grid-cols-3 gap-4 max-w-5xl">
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
          const queueFull = shipBuildQueue.length >= 5
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
              hasQueuedItems={shipBuildQueue.length > 0}
              canAfford={canAfford}
              buildTime={buildTime}
              fleetCount={fleetCount}
              metal={resources.metal}
              gas={resources.gas}
              attackBonus={techBonuses.ship_attack}
              defenseBonus={techBonuses.ship_defense}
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
  hasQueuedItems,
  canAfford,
  buildTime,
  fleetCount,
  metal,
  gas,
  attackBonus,
  defenseBonus,
  onBuild,
}: {
  ship: ReturnType<typeof getShipConfig>
  isLocked: boolean
  lockReason?: string
  canBuild: boolean
  queueFull: boolean
  hasQueuedItems: boolean
  canAfford: boolean
  buildTime: number
  fleetCount: number
  metal: number
  gas: number
  attackBonus: number
  defenseBonus: number
  onBuild: () => Promise<void> | void
}) {
  const [building, setBuilding] = useState(false)

  async function handleBuild() {
    setBuilding(true)
    try {
      await onBuild()
    } catch (err) {
      console.error('Failed to build ship:', err)
    } finally {
      setBuilding(false)
    }
  }

  if (isLocked) {
    return (
      <div className="bg-slate-800/20 rounded-xl border border-dashed border-slate-700/30 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <div className="text-sm font-bold text-slate-600">{ship.name}</div>
        </div>
        <img src={ship.image} alt={ship.name} className="w-full h-36 object-cover opacity-30 grayscale" />
        <div className="px-4 py-3 text-[11px] text-slate-600">Requires {lockReason}</div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700/20 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="text-sm font-bold text-slate-100">{ship.name}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">Fleet: {fleetCount}</div>
      </div>

      {/* Full-width image */}
      <img src={ship.image} alt={ship.name} className="w-full h-36 object-cover" />

      {/* Body */}
      <div className="px-4 pt-3 pb-4 flex flex-col flex-1 gap-3">
        <p className="text-[11px] text-slate-400 leading-relaxed flex-1">{ship.description}</p>

        {/* Stats — 4-column: label value | label value */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <StatRow label="Speed" value={ship.stats.speed} />
          <StatRow label="Cargo" value={ship.stats.cargoCapacity} />
          <BoostedStatRow label="Attack" base={ship.stats.attackPower} bonus={attackBonus} />
          <BoostedStatRow label="Defense" base={ship.stats.defenseRating} bonus={defenseBonus} />
        </div>

        {/* Cost */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className={`w-2 h-2 rounded-full ${metal >= ship.cost.metal ? 'bg-orange-400' : 'bg-red-500'}`} />
            <span className={metal >= ship.cost.metal ? 'text-slate-300' : 'text-red-400'}>
              {ship.cost.metal.toLocaleString()}
            </span>
          </div>
          {ship.cost.gas > 0 && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <div className={`w-2 h-2 rounded-full ${gas >= ship.cost.gas ? 'bg-violet-400' : 'bg-red-500'}`} />
              <span className={gas >= ship.cost.gas ? 'text-slate-300' : 'text-red-400'}>
                {ship.cost.gas.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          Build time: {formatTime(buildTime * 1000)}
        </div>

        <button
          onClick={handleBuild}
          disabled={!canBuild || building}
          className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {building ? 'Building...' : queueFull ? 'Queue Full (5)' : !canAfford ? 'Insufficient Resources' : hasQueuedItems ? 'Add to Queue →' : 'Build →'}
        </button>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">{value.toLocaleString()}</span>
    </div>
  )
}

function BoostedStatRow({ label, base, bonus }: { label: string; base: number; bonus: number }) {
  const boosted = Math.round(base * (1 + bonus))
  const hasBonuses = bonus > 0.001
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">
        {hasBonuses ? (
          <>
            <span className="text-slate-600 line-through mr-1">{base}</span>
            {boosted}
            <span className="text-emerald-400 ml-1">(+{Math.round(bonus * 100)}%)</span>
          </>
        ) : (
          base
        )}
      </span>
    </div>
  )
}
