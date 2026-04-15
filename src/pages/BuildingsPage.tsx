import { useState } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import { BuildingCard } from '../components/BuildingCard'
import { BuildingDetail } from '../components/BuildingDetail'
import { BUILDINGS, getBuildingConfig } from '../config/buildings'
import type { BuildingCategory } from '../config/buildings'
import type { GameContext } from '../components/Layout'

const CATEGORIES: { id: BuildingCategory; label: string }[] = [
  { id: 'resource', label: 'Resource' },
  { id: 'storage', label: 'Storage' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'defense', label: 'Defense' },
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
  const { buildings, resources, weather, activeBuild, startBuild } = useOutletContext<GameContext>()
  const [selectedCategory, setSelectedCategory] = useState<BuildingCategory>('resource')

  const buildingLevels = new Map(buildings.map((b) => [b.building_id, b.level]))

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
    </div>
  )
}
