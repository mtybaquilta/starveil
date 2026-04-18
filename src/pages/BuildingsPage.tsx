import { useState } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import { BuildingCard } from '../components/BuildingCard'
import { BuildingDetail } from '../components/BuildingDetail'
import { BUILDINGS, getBuildingConfig } from '../config/buildings'
import { DEFENSES } from '../config/defenses'
import { formatTime } from '../hooks/useConstructionQueue'
import type { BuildingCategory } from '../config/buildings'
import type { GameContext } from '../components/Layout'

const CATEGORIES: { id: BuildingCategory; label: string }[] = [
  { id: 'resource', label: 'Resource' },
  { id: 'storage', label: 'Storage' },
  { id: 'infrastructure', label: 'Infrastructure' },
]

function isBuildingUnlocked(
  buildingId: string,
  buildingLevels: Map<string, number>
): { unlocked: boolean; prerequisiteText?: string } {
  const config = getBuildingConfig(buildingId)
  for (const prereq of config.prerequisites) {
    const currentLevel = buildingLevels.get(prereq.buildingId) ?? 0
    if (currentLevel < prereq.level) {
      const prereqConfig = getBuildingConfig(prereq.buildingId)
      return {
        unlocked: false,
        prerequisiteText: `Requires ${prereqConfig.name} Lv.${prereq.level}`,
      }
    }
  }
  return { unlocked: true }
}

export function BuildingsPage() {
  const { buildingId } = useParams()
  const { buildings, resources, weather, activeBuild, startBuild, defenseFleet, startShipBuild, activeShipBuild, shipBuildQueue } = useOutletContext<GameContext>()
  const [selectedCategory, setSelectedCategory] = useState<BuildingCategory>('resource')

  const buildingLevels = new Map(buildings.map((b) => [b.building_id, b.level]))
  const defenseCounts = new Map(defenseFleet.map((d) => [d.defense_type, d.count]))

  if (buildingId) {
    return (
      <BuildingDetail
        buildingId={buildingId}
        buildings={buildings}
        metal={resources.metal}
        gas={resources.gas}
        activeBuild={activeBuild}
        onStartBuild={startBuild}
        resources={resources}
        weather={weather}
      />
    )
  }

  const filteredBuildings = BUILDINGS.filter((b) => b.category === selectedCategory)

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-100 mb-1">Buildings</h1>
      <p className="text-xs text-slate-500 mb-5">Construct and upgrade your colony infrastructure</p>

      {/* Category Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-800/30 rounded-lg p-1 w-fit">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              selectedCategory === cat.id
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {filteredBuildings.map((config) => {
          const level = buildingLevels.get(config.id) ?? 0
          const { unlocked, prerequisiteText } = isBuildingUnlocked(config.id, buildingLevels)
          return (
            <BuildingCard
              key={config.id}
              buildingId={config.id}
              level={level}
              isUnlocked={unlocked}
              prerequisiteText={prerequisiteText}
            />
          )
        })}
      </div>

      {/* Defenses section */}
      <h2 className="text-sm font-semibold text-slate-300 mt-8 mb-1">Defenses</h2>
      <p className="text-xs text-slate-500 mb-4">Build planetary defense units via the Shipyard queue</p>
      <div className="grid grid-cols-3 gap-3">
        {DEFENSES.map((def) => {
          const count = defenseCounts.get(def.id) ?? 0
          const queueFull = (shipBuildQueue?.length ?? 0) >= 5
          const isBuilding = !!activeShipBuild
          const canAfford = resources.metal >= def.cost.metal && resources.gas >= def.cost.gas
          const prereqMet = def.prerequisites.every((p) => {
            if (p.kind === 'building') return (buildingLevels.get(p.buildingId) ?? 0) >= p.level
            return (defenseCounts.get(p.defenseType) ?? 0) >= p.count
          })
          const lockReason = !prereqMet
            ? def.prerequisites
                .filter((p) => p.kind === 'building' ? (buildingLevels.get(p.buildingId) ?? 0) < p.level : (defenseCounts.get(p.defenseType) ?? 0) < p.count)
                .map((p) => p.kind === 'building' ? `${p.buildingId} Lv.${p.level}` : `${p.count}× ${p.defenseType}`)
                .join(', ')
            : undefined

          return (
            <DefenseCard
              key={def.id}
              def={def}
              count={count}
              isLocked={!prereqMet}
              lockReason={lockReason}
              queueFull={queueFull}
              isBuilding={isBuilding}
              canAfford={canAfford}
              metal={resources.metal}
              gas={resources.gas}
              onBuild={() => startShipBuild(def.id, 1)}
            />
          )
        })}
      </div>
    </div>
  )
}

function DefenseCard({
  def,
  count,
  isLocked,
  lockReason,
  queueFull,
  canAfford,
  metal,
  gas,
  onBuild,
}: {
  def: import('../config/defenses').DefenseConfig
  count: number
  isLocked: boolean
  lockReason?: string
  queueFull: boolean
  isBuilding: boolean
  canAfford: boolean
  metal: number
  gas: number
  onBuild: () => Promise<void> | void
}) {
  const [building, setBuilding] = useState(false)

  async function handleBuild() {
    setBuilding(true)
    try { await onBuild() } catch (err) { console.error(err) } finally { setBuilding(false) }
  }

  if (isLocked) {
    return (
      <div className="bg-slate-800/20 rounded-xl border border-dashed border-slate-700/30 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <div className="text-sm font-bold text-slate-600">{def.name}</div>
        </div>
        <img src={def.image} alt={def.name} className="w-full h-36 object-cover opacity-30 grayscale" />
        <div className="px-4 py-3 text-[11px] text-slate-600">Requires {lockReason}</div>
      </div>
    )
  }

  const disabled = queueFull || !canAfford || building
  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700/20 overflow-hidden flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="text-sm font-bold text-slate-100">{def.name}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">Deployed: {count}</div>
      </div>
      <img src={def.image} alt={def.name} className="w-full h-36 object-cover" />
      <div className="px-4 pt-3 pb-4 flex flex-col flex-1 gap-3">
        <p className="text-[11px] text-slate-400 leading-relaxed flex-1">{def.description}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Attack</span>
            <span className="text-slate-300">{def.attack}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Defense</span>
            <span className="text-slate-300">{def.defense}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className={`w-2 h-2 rounded-full ${metal >= def.cost.metal ? 'bg-orange-400' : 'bg-red-500'}`} />
            <span className={metal >= def.cost.metal ? 'text-slate-300' : 'text-red-400'}>{def.cost.metal.toLocaleString()}</span>
          </div>
          {def.cost.gas > 0 && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <div className={`w-2 h-2 rounded-full ${gas >= def.cost.gas ? 'bg-violet-400' : 'bg-red-500'}`} />
              <span className={gas >= def.cost.gas ? 'text-slate-300' : 'text-red-400'}>{def.cost.gas.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="text-[11px] text-slate-500">Build time: {formatTime(def.baseBuildTimeSeconds * 1000)}</div>
        <button
          onClick={handleBuild}
          disabled={disabled}
          className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {building ? 'Building...' : queueFull ? 'Queue Full (5)' : !canAfford ? 'Insufficient Resources' : 'Build →'}
        </button>
      </div>
    </div>
  )
}
