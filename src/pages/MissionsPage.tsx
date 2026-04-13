import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { MISSION_TYPES, getMissionConfig } from '../config/missions'
import { SHIPS } from '../config/ships'
import { formatTime } from '../hooks/useConstructionQueue'
import type { GameContext } from '../components/Layout'
import type { Mission, GalaxyMapEntry } from '../hooks/usePlanet'

const MISSION_TYPE_TARGETS: Record<string, string[]> = {
  mining:  ['asteroid_field'],
  raid:    ['bandit_camp'],
  salvage: ['debris_field', 'asteroid_field', 'bandit_camp', 'empty'],
}

function getTargetOptions(missionType: string, galaxyMap: GalaxyMapEntry[]): GalaxyMapEntry[] {
  const allowed = MISSION_TYPE_TARGETS[missionType] ?? []
  return galaxyMap.filter((e) => {
    if (e.visibility !== 'revealed') return false
    if (!e.location_type || !allowed.includes(e.location_type)) return false
    // Raid targets must have active content
    if (missionType === 'raid' && e.cleared_at && (!e.respawns_at || new Date(e.respawns_at) > new Date())) return false
    return true
  })
}

export function MissionsPage() {
  const { activeMissions, dispatchMission, shipFleet, galaxyMap, missions } = useOutletContext<GameContext>()

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [fleet, setFleet] = useState<Record<string, number>>({})
  const [targetCoords, setTargetCoords] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  // Pre-select from galaxy map navigation (?target=...&type=...)
  useEffect(() => {
    const paramType = searchParams.get('type')
    const paramTarget = searchParams.get('target')
    if (paramType && !selectedType) {
      setSelectedType(paramType)
      if (paramTarget) setTargetCoords(paramTarget)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, selectedType, setSearchParams])

  const fleetCounts = new Map(shipFleet.map((s) => [s.ship_type, s.count]))

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
  const config = selectedType ? getMissionConfig(selectedType) : null
  const hasRequiredShip = config ? config.requiredShips.some((s) => (fleet[s] ?? 0) > 0) : false

  const revealedLocations = galaxyMap.filter((e) => e.visibility === 'revealed')
  const targetOptions = selectedType ? getTargetOptions(selectedType, galaxyMap) : []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Missions</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {activeMissions.length === 0
            ? 'No active missions'
            : `${activeMissions.length} active mission${activeMissions.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Active Missions */}
      {activeMissions.length > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-indigo-700/20">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Active Missions</h2>
          <div className="space-y-3">
            {activeMissions.map((mission) => (
              <ActiveMissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        </div>
      )}

      {/* No revealed locations prompt */}
      {revealedLocations.length === 0 && (
        <div className="bg-slate-800/30 rounded-xl p-5 border border-dashed border-slate-700/30 text-center">
          <div className="text-2xl mb-2">🔭</div>
          <p className="text-sm text-slate-400 font-medium">No mission targets available</p>
          <p className="text-xs text-slate-600 mt-1 mb-3">
            Use your <strong className="text-slate-400">Radar Array</strong> to detect coordinates, then <strong className="text-slate-400">send a Probe</strong> to reveal what's there before dispatching missions.
          </p>
          <Link to="/galaxy" className="inline-block px-3 py-1.5 text-xs font-medium rounded bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 transition-colors">
            Open Galaxy Map
          </Link>
        </div>
      )}

      {/* Dispatch New Mission */}
      {revealedLocations.length > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/10">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Dispatch Mission</h2>

          {/* Mission Type Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {MISSION_TYPES.map((mc) => {
              const isSelected = selectedType === mc.type
              const options = getTargetOptions(mc.type, galaxyMap)
              return (
                <button
                  key={mc.type}
                  onClick={() => {
                    setSelectedType(isSelected ? null : mc.type)
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
                  <div className="text-[10px] text-slate-500 mt-0.5">{options.length} target{options.length !== 1 ? 's' : ''} available</div>
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
                    No valid targets for this mission type. Explore the galaxy map to find more locations.
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
                        {t.name ?? t.coordinates} ({t.coordinates}) — {t.location_type?.replace(/_/g, ' ')}
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
                    const isRelevant = config.requiredShips.includes(ship.id)
                    return (
                      <div key={ship.id} className={`flex items-center gap-3 ${isRelevant ? '' : 'opacity-60'}`}>
                        <span className="text-sm w-6 text-center">{ship.icon}</span>
                        <span className="text-xs text-slate-300 w-32 truncate">{ship.name}</span>
                        <span className="text-[10px] text-slate-500 w-16">Avail: {avail}</span>
                        <button
                          onClick={() => setFleet((f) => ({ ...f, [ship.id]: Math.max(0, count - 1) }))}
                          disabled={count === 0}
                          className="w-6 h-6 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-30"
                        >-</button>
                        <span className="text-xs text-slate-200 w-6 text-center">{count}</span>
                        <button
                          onClick={() => setFleet((f) => ({ ...f, [ship.id]: Math.min(avail, count + 1) }))}
                          disabled={avail <= count}
                          className="w-6 h-6 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-30"
                        >+</button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Fleet Summary */}
              {totalFleetShips > 0 && <FleetSummary fleet={fleet} />}

              {/* Validation + Dispatch */}
              {error && <p className="text-xs text-red-400">{error}</p>}

              {totalFleetShips > 0 && !hasRequiredShip && (
                <p className="text-[10px] text-amber-400">
                  Requires at least one: {config.requiredShips.join(', ')}
                </p>
              )}

              <button
                onClick={handleDispatch}
                disabled={dispatching || !targetCoords || totalFleetShips === 0 || !hasRequiredShip}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {dispatching ? 'Dispatching...' : 'Dispatch Fleet'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ActiveMissionCard({ mission }: { mission: Mission }) {
  const config = (() => { try { return getMissionConfig(mission.mission_type) } catch { return null } })()
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const update = () => setTimeLeft(Math.max(0, new Date(mission.returns_at).getTime() - Date.now()))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [mission.returns_at])

  const totalMs = new Date(mission.returns_at).getTime() - new Date(mission.dispatched_at).getTime()
  const progress = totalMs > 0 ? Math.min(100, ((totalMs - timeLeft) / totalMs) * 100) : 0

  const fleetStr = Object.entries(mission.fleet)
    .filter(([, c]) => c > 0)
    .map(([type, count]) => `${SHIPS.find((s) => s.id === type)?.name ?? type} ×${count}`)
    .join(', ')

  return (
    <div className="bg-slate-900/40 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{config?.icon ?? '🚀'}</span>
          <span className="text-xs font-semibold text-slate-200">{config?.name ?? mission.mission_type}</span>
          <span className="text-[10px] text-slate-500">→ {mission.target_name}</span>
        </div>
        <span className="text-xs font-bold text-indigo-400">{formatTime(timeLeft)}</span>
      </div>
      <div className="text-[10px] text-slate-600 mb-2">{fleetStr}</div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function FleetSummary({ fleet }: { fleet: Record<string, number> }) {
  let totalAtk = 0, totalDef = 0, totalCargo = 0, slowest = Infinity
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
