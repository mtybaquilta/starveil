import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MISSION_CONFIGS, type MissionType } from '../config/missions'
import { SHIPS } from '../config/ships'
import { formatTime } from '../hooks/useConstructionQueue'
import type { GameContext } from '../components/Layout'
import type { Mission, NearbySector, KnownLocation } from '../hooks/usePlanet'

export function MissionsPage() {
  const {
    activeMissions,
    dispatchMission,
    generateSectors,
    shipFleet,
    nearbySectors,
    knownLocations,
    missions,
  } = useOutletContext<GameContext>()

  const [selectedType, setSelectedType] = useState<MissionType | null>(null)
  const [fleet, setFleet] = useState<Record<string, number>>({})
  const [targetCoords, setTargetCoords] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingSectors, setGeneratingSectors] = useState(false)

  // Auto-generate sectors on first visit if none exist
  useEffect(() => {
    if (nearbySectors.length === 0 && !generatingSectors) {
      setGeneratingSectors(true)
      generateSectors().finally(() => setGeneratingSectors(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fleetCounts = new Map(shipFleet.map((s) => [s.ship_type, s.count]))

  // Compute deployed ships from active missions
  const deployedCounts = new Map<string, number>()
  for (const m of activeMissions) {
    for (const [type, count] of Object.entries(m.fleet)) {
      deployedCounts.set(type, (deployedCounts.get(type) || 0) + count)
    }
  }

  const availableCount = (shipType: string) =>
    (fleetCounts.get(shipType) ?? 0) - (deployedCounts.get(shipType) ?? 0)

  const handleDispatch = useCallback(async () => {
    if (!selectedType || !targetCoords) return
    setDispatching(true)
    setError(null)
    try {
      await dispatchMission(selectedType, fleet, targetCoords)
      setSelectedType(null)
      setFleet({})
      setTargetCoords('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDispatching(false)
    }
  }, [selectedType, fleet, targetCoords, dispatchMission])

  const totalFleetShips = Object.values(fleet).reduce((a, b) => a + b, 0)
  const config = selectedType ? MISSION_CONFIGS[selectedType] : null
  const hasRequiredShip = config
    ? config.requiredShips.some((s) => (fleet[s] ?? 0) > 0)
    : false

  // Recently completed missions (last 5)
  const completedMissions = missions
    .filter((m) => m.status === 'completed' && m.result)
    .slice(0, 5)

  // Target options based on mission type
  const targetOptions = selectedType === 'raid'
    ? knownLocations.filter((l) => l.location_type === 'bandit_camp')
    : nearbySectors

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-100 mb-1">Missions</h1>
      <p className="text-xs text-slate-500 mb-6">
        {activeMissions.length === 0
          ? 'No active missions'
          : `${activeMissions.length} active mission${activeMissions.length !== 1 ? 's' : ''}`}
      </p>

      {/* Active Missions */}
      {activeMissions.length > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-5 border border-indigo-700/20 mb-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Active Missions</h2>
          <div className="space-y-3">
            {activeMissions.map((mission) => (
              <ActiveMissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        </div>
      )}

      {/* Recently Completed */}
      {completedMissions.length > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/10 mb-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Recent Results</h2>
          <div className="space-y-3">
            {completedMissions.map((mission) => (
              <MissionResultCard key={mission.id} mission={mission} />
            ))}
          </div>
        </div>
      )}

      {/* Dispatch New Mission */}
      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/10 mb-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Dispatch Mission</h2>

        {/* Mission Type Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {(Object.keys(MISSION_CONFIGS) as MissionType[]).map((type) => {
            const mc = MISSION_CONFIGS[type]
            const isSelected = selectedType === type
            return (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(isSelected ? null : type)
                  setFleet({})
                  setTargetCoords('')
                  setError(null)
                }}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-slate-700/20 bg-slate-800/50 hover:border-slate-600/30'
                }`}
              >
                <div className="text-xl mb-1">{mc.icon}</div>
                <div className="text-xs font-semibold text-slate-200">{mc.name}</div>
                <div className="text-[10px] text-slate-500 mt-1">{mc.description}</div>
              </button>
            )
          })}
        </div>

        {/* Dispatch Form */}
        {selectedType && config && (
          <div className="border border-slate-700/20 rounded-lg p-4 space-y-4">
            {/* Target Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Target</label>
              {targetOptions.length === 0 ? (
                <p className="text-xs text-slate-600">
                  {selectedType === 'raid'
                    ? 'No bandit camps discovered. Send scouts first!'
                    : 'No nearby sectors available.'}
                </p>
              ) : (
                <select
                  value={targetCoords}
                  onChange={(e) => setTargetCoords(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/30 rounded px-3 py-1.5 text-xs text-slate-200"
                >
                  <option value="">Select target...</option>
                  {targetOptions.map((t) => (
                    <option key={t.coordinates} value={t.coordinates}>
                      {t.name} ({t.coordinates})
                      {'distance' in t ? ` — ${(t as NearbySector).distance} units` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Fleet Picker */}
            <div>
              <label className="text-xs text-slate-400 block mb-2">Fleet Composition</label>
              <div className="space-y-2">
                {SHIPS.map((ship) => {
                  const avail = availableCount(ship.id)
                  const count = fleet[ship.id] ?? 0
                  return (
                    <div key={ship.id} className="flex items-center gap-3">
                      <span className="text-sm w-6 text-center">{ship.icon}</span>
                      <span className="text-xs text-slate-300 w-28">{ship.name}</span>
                      <span className="text-[10px] text-slate-500 w-20">Avail: {avail}</span>
                      <button
                        onClick={() =>
                          setFleet((f) => ({ ...f, [ship.id]: Math.max(0, count - 1) }))
                        }
                        disabled={count === 0}
                        className="w-6 h-6 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-30"
                      >
                        -
                      </button>
                      <span className="text-xs text-slate-200 w-6 text-center">{count}</span>
                      <button
                        onClick={() =>
                          setFleet((f) => ({
                            ...f,
                            [ship.id]: Math.min(avail, count + 1),
                          }))
                        }
                        disabled={avail <= count}
                        className="w-6 h-6 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Fleet Summary */}
            {totalFleetShips > 0 && (
              <FleetSummary fleet={fleet} />
            )}

            {/* Validation + Dispatch */}
            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={handleDispatch}
              disabled={
                dispatching ||
                !targetCoords ||
                totalFleetShips === 0 ||
                !hasRequiredShip
              }
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {dispatching ? 'Dispatching...' : 'Dispatch Fleet'}
            </button>

            {totalFleetShips > 0 && !hasRequiredShip && (
              <p className="text-[10px] text-amber-400">
                Requires at least one: {config.requiredShips.map((s) => SHIPS.find((sh) => sh.id === s)?.name).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Known Locations */}
      {knownLocations.length > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/10">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Known Locations</h2>
          <div className="space-y-2">
            {knownLocations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between py-2 border-b border-slate-700/10 last:border-0"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">{loc.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {loc.coordinates} — {loc.location_type.replace(/_/g, ' ')}
                  </div>
                </div>
                {loc.location_type === 'bandit_camp' && (
                  <button
                    onClick={() => {
                      setSelectedType('raid')
                      setFleet({})
                      setTargetCoords(loc.coordinates)
                      setError(null)
                    }}
                    className="text-[10px] px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                  >
                    Raid
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveMissionCard({ mission }: { mission: Mission }) {
  const config = MISSION_CONFIGS[mission.mission_type as MissionType]
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const update = () => {
      const ms = new Date(mission.returns_at).getTime() - Date.now()
      setTimeLeft(Math.max(0, ms))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [mission.returns_at])

  const totalMs = new Date(mission.returns_at).getTime() - new Date(mission.dispatched_at).getTime()
  const progress = totalMs > 0 ? Math.min(100, ((totalMs - timeLeft) / totalMs) * 100) : 0

  const fleetStr = Object.entries(mission.fleet)
    .filter(([, c]) => c > 0)
    .map(([type, count]) => `${SHIPS.find((s) => s.id === type)?.name ?? type} x${count}`)
    .join(', ')

  return (
    <div className="bg-slate-900/40 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{config?.icon ?? '🚀'}</span>
          <span className="text-xs font-semibold text-slate-200">{config?.name ?? mission.mission_type}</span>
        </div>
        <span className="text-xs font-bold text-indigo-400">{formatTime(timeLeft)}</span>
      </div>
      <div className="text-[10px] text-slate-500 mb-2">
        {mission.target_name} ({mission.target_coords}) — {fleetStr}
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function MissionResultCard({ mission }: { mission: Mission }) {
  const [expanded, setExpanded] = useState(false)
  const config = MISSION_CONFIGS[mission.mission_type as MissionType]
  const result = mission.result
  if (!result) return null

  const hasRewards = result.rewards && (result.rewards.metal || result.rewards.gas)
  const hasLosses = result.ships_lost && Object.values(result.ships_lost).some((v) => v > 0)
  const hasCombat = result.combat_log && result.combat_log.length > 0

  return (
    <div className="bg-slate-900/40 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{config?.icon ?? '🚀'}</span>
          <span className="text-xs font-semibold text-slate-200">{config?.name ?? mission.mission_type}</span>
          <span className="text-[10px] text-slate-500">{mission.target_name}</span>
        </div>
        {result.encounter_type && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
            {result.encounter_type.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div className="flex gap-4 mt-2">
        {hasRewards && (
          <div className="text-[10px]">
            <span className="text-slate-500">Rewards:</span>{' '}
            {result.rewards!.metal ? <span className="text-amber-400">{result.rewards!.metal} metal</span> : null}
            {result.rewards!.metal && result.rewards!.gas ? ', ' : ''}
            {result.rewards!.gas ? <span className="text-cyan-400">{result.rewards!.gas} gas</span> : null}
          </div>
        )}
        {hasLosses && (
          <div className="text-[10px]">
            <span className="text-slate-500">Lost:</span>{' '}
            <span className="text-red-400">
              {Object.entries(result.ships_lost!)
                .filter(([, v]) => v > 0)
                .map(([type, count]) => `${count} ${SHIPS.find((s) => s.id === type)?.name ?? type}`)
                .join(', ')}
            </span>
          </div>
        )}
        {result.discovered && (
          <div className="text-[10px]">
            <span className="text-slate-500">Discovered:</span>{' '}
            <span className="text-emerald-400">{result.discovered.name}</span>
          </div>
        )}
      </div>

      {hasCombat && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-2"
        >
          {expanded ? 'Hide combat log' : 'Show combat log'}
        </button>
      )}

      {expanded && hasCombat && (
        <div className="mt-2 bg-slate-950/50 rounded p-2 max-h-48 overflow-y-auto">
          {(result.combat_log as { round: number; attackerFire: { shipType: string; target: string; damage: number; destroyed: boolean }[]; defenderFire: { shipType: string; target: string; damage: number; destroyed: boolean }[] }[]).map((round) => (
            <div key={round.round} className="mb-2 last:mb-0">
              <div className="text-[10px] text-slate-400 font-semibold">Round {round.round}</div>
              {round.attackerFire.map((shot, i) => (
                <div key={`a${i}`} className="text-[10px] text-slate-500 pl-2">
                  {shot.shipType} hits {shot.target} for {shot.damage} dmg
                  {shot.destroyed && <span className="text-red-400"> (destroyed!)</span>}
                </div>
              ))}
              {round.defenderFire.map((shot, i) => (
                <div key={`d${i}`} className="text-[10px] text-amber-700 pl-2">
                  {shot.target} hits {shot.shipType} for {shot.damage} dmg
                  {shot.destroyed && <span className="text-red-400"> (destroyed!)</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FleetSummary({ fleet }: { fleet: Record<string, number> }) {
  let totalAtk = 0
  let totalDef = 0
  let totalCargo = 0
  let slowest = Infinity

  for (const [shipId, count] of Object.entries(fleet)) {
    if (count <= 0) continue
    const ship = SHIPS.find((s) => s.id === shipId)
    if (!ship) continue
    totalAtk += ship.stats.attackPower * count
    totalDef += ship.stats.defenseRating * count
    totalCargo += ship.stats.cargoCapacity * count
    if (ship.stats.speed < slowest) slowest = ship.stats.speed
  }

  if (slowest === Infinity) slowest = 0

  return (
    <div className="flex gap-4 text-[10px] text-slate-500">
      <span>Atk: <span className="text-slate-300">{totalAtk}</span></span>
      <span>Def: <span className="text-slate-300">{totalDef}</span></span>
      <span>Cargo: <span className="text-slate-300">{totalCargo.toLocaleString()}</span></span>
      <span>Speed: <span className="text-slate-300">{slowest}</span></span>
    </div>
  )
}
