import { useOutletContext } from 'react-router-dom'
import { PlanetVisual } from '../components/PlanetVisual'
import { BuildingCard } from '../components/BuildingCard'
import { EventTimeline } from '../components/EventTimeline'
import { WeatherDisplay } from '../components/WeatherDisplay'
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

export function OverviewPage() {
  const { planet, buildings, weather, events } = useOutletContext<GameContext>()

  const buildingLevels = new Map(buildings.map((b) => [b.building_id, b.level]))
  const usedSlots = buildings.filter((b) => b.level > 0).length

  return (
    <div>
      {/* Planet Header */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-100">{planet.name}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Temperate · Diameter: {planet.diameter.toLocaleString()} km · Slots: {usedSlots}/{planet.max_building_slots} used
        </p>
      </div>

      {/* Weather */}
      <div className="mb-5">
        <WeatherDisplay weather={weather} buildings={buildings} />
      </div>

      {/* Planet Visual */}
      <div className="mb-6">
        <PlanetVisual />
      </div>

      {/* Event Timeline */}
      <div className="mb-6">
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Recent Events</h2>
        <EventTimeline events={events} />
      </div>

      {/* Building Grid */}
      <div>
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Buildings</h2>
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
    </div>
  )
}
