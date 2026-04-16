import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IS_DEV_MODE } from '../lib/devMode'
import { SHIPS } from '../config/ships'
import { formatTime } from '../hooks/useConstructionQueue'
import { getTechBonuses } from '../lib/techBonuses'
import type { GameContext } from '../components/Layout'

export function FleetPage() {
  const { planet, shipFleet, activeShipBuild, shipBuildQueue, shipTimeRemaining, activeMissions, refetch, technologies, planets } = useOutletContext<GameContext>()
  const techBonuses = getTechBonuses(technologies)
  const navigate = useNavigate()

  const [showTransfer, setShowTransfer] = useState(false)
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
      acc.attack += count * Math.round(ship.stats.attackPower * (1 + techBonuses.ship_attack))
      acc.defense += count * Math.round(ship.stats.defenseRating * (1 + techBonuses.ship_defense))
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
                  <img src={ship?.image} alt={ship?.name} className="w-8 h-8 rounded object-cover" />
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

      {/* Transfer button */}
      {planets.length > 1 && (
        <button
          onClick={() => setShowTransfer((s) => !s)}
          className="w-full py-3 text-sm font-medium rounded-lg bg-emerald-600/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/25 transition-colors cursor-pointer"
        >
          {showTransfer ? 'Hide Transfer Panel' : 'Transfer Resources to Another Planet'}
        </button>
      )}

      {/* Transfer Panel */}
      {showTransfer && planets.length > 1 && (
        <TransferPanel
          sourcePlanet={planet}
          planets={planets.filter((p) => p.id !== planet.id)}
          shipFleet={shipFleet}
          deployedCounts={deployedCounts}
          onComplete={refetch}
        />
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
              attackBonus={techBonuses.ship_attack}
              defenseBonus={techBonuses.ship_defense}
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
  attackBonus,
  defenseBonus,
}: {
  ship: (typeof SHIPS)[number]
  count: number
  available: number
  deployed: number
  planetId: string
  onScrap: () => Promise<void>
  onDeploy: () => void
  attackBonus: number
  defenseBonus: number
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
        <img src={ship.image} alt={ship.name} className="w-10 h-10 rounded-md object-cover" />
        <div>
          <div className="text-sm font-semibold text-slate-200">{ship.name}</div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
            <span>Spd {ship.stats.speed}</span>
            <span>·</span>
            <span>
              {attackBonus > 0.001 ? (
                <>Atk <span className="line-through opacity-50">{ship.stats.attackPower}</span> <span className="text-slate-300">{Math.round(ship.stats.attackPower * (1 + attackBonus))}</span></>
              ) : (
                <>Atk {ship.stats.attackPower}</>
              )}
            </span>
            <span>·</span>
            <span>
              {defenseBonus > 0.001 ? (
                <>Def <span className="line-through opacity-50">{ship.stats.defenseRating}</span> <span className="text-slate-300">{Math.round(ship.stats.defenseRating * (1 + defenseBonus))}</span></>
              ) : (
                <>Def {ship.stats.defenseRating}</>
              )}
            </span>
            <span>· Cargo {ship.stats.cargoCapacity.toLocaleString()}</span>
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

function TransferPanel({
  sourcePlanet,
  planets,
  shipFleet,
  deployedCounts,
  onComplete,
}: {
  sourcePlanet: { id: string; metal_amount: number; gas_amount: number }
  planets: { id: string; name: string; coordinates: string }[]
  shipFleet: { ship_type: string; count: number }[]
  deployedCounts: Map<string, number>
  onComplete: () => Promise<void>
}) {
  const [destId, setDestId] = useState(planets[0]?.id ?? '')
  const [metal, setMetal] = useState(0)
  const [gas, setGas] = useState(0)
  const [fleetSelection, setFleetSelection] = useState<Record<string, number>>({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargoShips = SHIPS.filter((s) => s.stats.cargoCapacity > 0)
  const totalCapacity = Object.entries(fleetSelection).reduce((sum, [shipType, count]) => {
    const ship = SHIPS.find((s) => s.id === shipType)
    return sum + (ship?.stats.cargoCapacity ?? 0) * count
  }, 0)
  const totalResources = metal + gas
  const overCapacity = totalResources > totalCapacity

  const handleSend = async () => {
    setSending(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.functions.invoke('game-action', {
        body: {
          action: 'dispatch_transfer',
          planetId: sourcePlanet.id,
          destinationPlanetId: destId,
          fleet: fleetSelection,
          resources: { metal, gas },
          devMode: IS_DEV_MODE,
        },
      })
      if (err) throw err
      if (data?.error) throw new Error(data.error)
      setMetal(0)
      setGas(0)
      setFleetSelection({})
      await onComplete()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-slate-800/40 rounded-xl p-5 border border-emerald-700/20 space-y-4">
      <h2 className="text-sm font-semibold text-emerald-400">Transfer Resources</h2>

      {/* Destination */}
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Destination</label>
        <select
          value={destId}
          onChange={(e) => setDestId(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700/40 rounded px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
        >
          {planets.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.coordinates})</option>
          ))}
        </select>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">
            Metal <span className="text-slate-600">(max {Math.floor(sourcePlanet.metal_amount).toLocaleString()})</span>
          </label>
          <input
            type="number"
            min={0}
            max={Math.floor(sourcePlanet.metal_amount)}
            value={metal}
            onChange={(e) => setMetal(Math.max(0, Math.min(Math.floor(sourcePlanet.metal_amount), Number(e.target.value) || 0)))}
            className="w-full bg-slate-900 border border-slate-700/40 rounded px-3 py-2 text-sm text-orange-400 focus:border-emerald-500/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">
            Gas <span className="text-slate-600">(max {Math.floor(sourcePlanet.gas_amount).toLocaleString()})</span>
          </label>
          <input
            type="number"
            min={0}
            max={Math.floor(sourcePlanet.gas_amount)}
            value={gas}
            onChange={(e) => setGas(Math.max(0, Math.min(Math.floor(sourcePlanet.gas_amount), Number(e.target.value) || 0)))}
            className="w-full bg-slate-900 border border-slate-700/40 rounded px-3 py-2 text-sm text-violet-400 focus:border-emerald-500/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Fleet selection */}
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">
          Cargo Fleet <span className={overCapacity ? 'text-red-400' : 'text-emerald-400'}>(capacity: {totalCapacity.toLocaleString()} / need: {totalResources.toLocaleString()})</span>
        </label>
        <div className="space-y-1.5">
          {cargoShips.map((ship) => {
            const total = shipFleet.find((s) => s.ship_type === ship.id)?.count ?? 0
            const deployed = deployedCounts.get(ship.id) ?? 0
            const available = total - deployed
            const selected = fleetSelection[ship.id] ?? 0
            if (available === 0 && selected === 0) return null
            return (
              <div key={ship.id} className="flex items-center gap-3">
                <span className="text-xs text-slate-300 min-w-[100px]">{ship.name}</span>
                <span className="text-[10px] text-slate-500">({available} available)</span>
                <input
                  type="number"
                  min={0}
                  max={available}
                  value={selected}
                  onChange={(e) => setFleetSelection((f) => ({ ...f, [ship.id]: Math.max(0, Math.min(available, Number(e.target.value) || 0)) }))}
                  className="w-16 bg-slate-900 border border-slate-700/40 rounded px-2 py-1 text-xs text-slate-200 focus:border-emerald-500/40 focus:outline-none"
                />
              </div>
            )
          })}
        </div>
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}

      <button
        onClick={handleSend}
        disabled={sending || totalResources === 0 || overCapacity || totalCapacity === 0}
        className="w-full py-2.5 text-sm font-semibold rounded-lg text-white disabled:opacity-40 transition-colors cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
      >
        {sending ? 'Sending...' : 'Send Transfer'}
      </button>
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
