import { useParams, useOutletContext } from 'react-router-dom'
import { BuildingCard } from '../components/BuildingCard'
import { BuildingDetail } from '../components/BuildingDetail'
import { BUILDINGS, getBuildingConfig } from '../config/buildings'
import type { GameContext } from '../components/Layout'

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
  const { buildings, resources, activeBuild, startBuild } = useOutletContext<GameContext>()

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
      />
    )
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-100 mb-1">Buildings</h1>
      <p className="text-xs text-slate-500 mb-5">Construct and upgrade your colony infrastructure</p>

      <div className="grid grid-cols-3 gap-3">
        {BUILDINGS.map((config) => {
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
