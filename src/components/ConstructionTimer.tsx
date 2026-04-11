import { formatTime } from '../hooks/useConstructionQueue'
import { getBuildingConfig } from '../config/buildings'
import { getShipConfig } from '../config/ships'
import type { ConstructionItem, ShipQueueItem } from '../hooks/usePlanet'

type Props = {
  activeBuild: ConstructionItem | null
  timeRemaining: number | null
  activeShipBuild: ShipQueueItem | null
  shipTimeRemaining: number | null
}

export function ConstructionTimer({ activeBuild, timeRemaining, activeShipBuild, shipTimeRemaining }: Props) {
  const hasBuilding = activeBuild !== null
  const hasShip = activeShipBuild !== null

  if (!hasBuilding && !hasShip) {
    return (
      <div className="px-4 py-3">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Construction</div>
        <div className="p-3 bg-slate-800/50 rounded-lg text-xs text-slate-500">
          No active build
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Construction</div>
      <div className={`grid gap-2 ${hasBuilding && hasShip ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {hasBuilding && (
          <BuildingPanel activeBuild={activeBuild} timeRemaining={timeRemaining} />
        )}
        {hasShip && (
          <ShipPanel activeShipBuild={activeShipBuild} shipTimeRemaining={shipTimeRemaining} />
        )}
      </div>
    </div>
  )
}

function BuildingPanel({ activeBuild, timeRemaining }: { activeBuild: ConstructionItem; timeRemaining: number | null }) {
  const config = getBuildingConfig(activeBuild.building_id)
  const totalMs = new Date(activeBuild.completes_at).getTime() - new Date(activeBuild.started_at).getTime()
  const elapsedMs = totalMs - (timeRemaining ?? 0)
  const progress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0

  return (
    <div className="p-2.5 bg-slate-800/80 rounded-lg">
      <div className="text-[10px] text-slate-400 mb-1">Building</div>
      <div className="text-xs text-slate-200 font-medium truncate">
        {config.name} → Lv.{activeBuild.target_level}
      </div>
      <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-400">
        {timeRemaining !== null ? formatTime(timeRemaining) : '...'}
      </div>
    </div>
  )
}

function ShipPanel({ activeShipBuild, shipTimeRemaining }: { activeShipBuild: ShipQueueItem; shipTimeRemaining: number | null }) {
  const config = getShipConfig(activeShipBuild.ship_type)
  const totalMs = new Date(activeShipBuild.completes_at).getTime() - new Date(activeShipBuild.started_at).getTime()
  const elapsedMs = totalMs - (shipTimeRemaining ?? 0)
  const progress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0

  return (
    <div className="p-2.5 bg-slate-800/80 rounded-lg">
      <div className="text-[10px] text-slate-400 mb-1">Fleet</div>
      <div className="text-xs text-slate-200 font-medium truncate">
        {config.name} ×{activeShipBuild.quantity}
      </div>
      <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-400">
        {shipTimeRemaining !== null ? formatTime(shipTimeRemaining) : '...'}
      </div>
    </div>
  )
}
