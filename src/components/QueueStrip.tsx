import { getBuildingConfig } from '../config/buildings'
import { getShipConfig } from '../config/ships'
import { getTechConfig } from '../config/technologies'
import { formatTime } from '../hooks/useConstructionQueue'
import type { ConstructionItem, ShipQueueItem, ResearchQueueItem } from '../hooks/usePlanet'

type Props = {
  activeBuild: ConstructionItem | null
  timeRemaining: number | null
  activeShipBuild: ShipQueueItem | null
  shipTimeRemaining: number | null
  activeResearch: ResearchQueueItem | null
  researchTimeRemaining: number | null
}

export function QueueStrip({
  activeBuild, timeRemaining,
  activeShipBuild, shipTimeRemaining,
  activeResearch, researchTimeRemaining,
}: Props) {
  const hasAnything = activeBuild || activeShipBuild || activeResearch
  if (!hasAnything) return null

  const buildingConfig = activeBuild ? getBuildingConfig(activeBuild.building_id) : null
  const shipConfig = activeShipBuild ? getShipConfig(activeShipBuild.ship_type) : null
  const techConfig = activeResearch ? (() => { try { return getTechConfig(activeResearch.tech_id) } catch { return null } })() : null

  return (
    <div className="flex items-center gap-0 bg-slate-950/90 border-b border-slate-800/50 px-4 py-0">
      {activeBuild && buildingConfig && (
        <QueueSlot
          image={buildingConfig.image}
          label={`${buildingConfig.name} → Lv.${activeBuild.target_level}`}
          timeRemaining={timeRemaining}
          startedAt={activeBuild.started_at}
          completesAt={activeBuild.completes_at}
          barColor="from-indigo-500 to-violet-500"
        />
      )}
      {activeBuild && activeShipBuild && <div className="w-px h-8 bg-slate-800/50 mx-3 shrink-0" />}
      {activeShipBuild && shipConfig && (
        <QueueSlot
          image={shipConfig.image}
          label={`${shipConfig.name} ×${activeShipBuild.quantity}`}
          timeRemaining={shipTimeRemaining}
          startedAt={activeShipBuild.started_at}
          completesAt={activeShipBuild.completes_at}
          barColor="from-sky-500 to-cyan-500"
        />
      )}
      {(activeBuild || activeShipBuild) && activeResearch && <div className="w-px h-8 bg-slate-800/50 mx-3 shrink-0" />}
      {activeResearch && (
        <QueueSlot
          label={`${techConfig?.name ?? activeResearch.tech_id.replace(/_/g, ' ')} → Lv.${activeResearch.target_level}`}
          timeRemaining={researchTimeRemaining}
          startedAt={activeResearch.started_at}
          completesAt={activeResearch.completes_at}
          barColor="from-violet-500 to-purple-500"
        />
      )}
    </div>
  )
}

function QueueSlot({
  image, label, timeRemaining, startedAt, completesAt, barColor,
}: {
  image?: string; label: string
  timeRemaining: number | null; startedAt: string; completesAt: string | null
  barColor: string
}) {
  if (!completesAt) return null
  const totalMs = new Date(completesAt).getTime() - new Date(startedAt).getTime()
  const elapsedMs = totalMs - (timeRemaining ?? 0)
  const progress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0

  return (
    <div className="flex items-center gap-2 py-1.5 min-w-[160px] max-w-[240px]">
      {image && (
        <img src={image} alt="" className="w-6 h-6 rounded object-cover shrink-0 opacity-80" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-300 truncate">{label}</span>
          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
            {timeRemaining !== null ? formatTime(timeRemaining) : '...'}
          </span>
        </div>
        <div className="mt-1 h-[2px] bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-1000`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
