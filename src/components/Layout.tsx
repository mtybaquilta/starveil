import { Outlet } from 'react-router-dom'
import { ResourceBar } from './ResourceBar'
import { Sidebar } from './Sidebar'
import { usePlanet } from '../hooks/usePlanet'
import { useResources } from '../hooks/useResources'
import { useConstructionQueue } from '../hooks/useConstructionQueue'
import { useShipQueue } from '../hooks/useShipQueue'
import { useMissions } from '../hooks/useMissions'

export function Layout() {
  const {
    planet, buildings, constructionQueue, shipFleet, shipQueue,
    missions, completedMissions, galaxyMap, technologies, researchQueue,
    weather, events, loading, refetch,
  } = usePlanet()
  const resources = useResources(planet, buildings, weather)
  const { activeBuild, timeRemaining, startBuild } = useConstructionQueue(
    planet?.id,
    constructionQueue,
    refetch
  )
  const { activeShipBuild, shipTimeRemaining, startShipBuild } = useShipQueue(
    planet?.id,
    shipQueue,
    refetch
  )
  const { activeMissions, dispatchMission } = useMissions(
    planet?.id,
    missions,
    refetch
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500">Loading your colony...</div>
      </div>
    )
  }

  if (!planet) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400">No planet found. Something went wrong.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <ResourceBar
        metal={resources.metal}
        gas={resources.gas}
        metalPerHour={resources.metalPerHour}
        gasPerHour={resources.gasPerHour}
        energyProduced={resources.energyProduced}
        energyConsumed={resources.energyConsumed}
        planetName={planet.name}
        coordinates={planet.coordinates}
        weatherType={weather?.weather_type ?? 'calm_skies'}
      />
      <div className="flex flex-1">
        <Sidebar
          activeBuild={activeBuild}
          timeRemaining={timeRemaining}
          activeShipBuild={activeShipBuild}
          shipTimeRemaining={shipTimeRemaining}
          activeMissionCount={activeMissions.length}
        />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet
            context={{
              planet,
              buildings,
              resources,
              weather,
              events,
              activeBuild,
              startBuild,
              activeShipBuild,
              shipTimeRemaining,
              startShipBuild,
              shipFleet,
              missions,
              completedMissions,
              activeMissions,
              dispatchMission,
              galaxyMap,
              technologies,
              researchQueue,
              refetch,
            }}
          />
        </main>
      </div>
    </div>
  )
}

export type GameContext = {
  planet: NonNullable<ReturnType<typeof usePlanet>['planet']>
  buildings: ReturnType<typeof usePlanet>['buildings']
  resources: ReturnType<typeof useResources>
  weather: ReturnType<typeof usePlanet>['weather']
  events: ReturnType<typeof usePlanet>['events']
  activeBuild: ReturnType<typeof useConstructionQueue>['activeBuild']
  startBuild: ReturnType<typeof useConstructionQueue>['startBuild']
  activeShipBuild: ReturnType<typeof useShipQueue>['activeShipBuild']
  shipTimeRemaining: ReturnType<typeof useShipQueue>['shipTimeRemaining']
  startShipBuild: ReturnType<typeof useShipQueue>['startShipBuild']
  shipFleet: ReturnType<typeof usePlanet>['shipFleet']
  missions: ReturnType<typeof usePlanet>['missions']
  completedMissions: ReturnType<typeof usePlanet>['completedMissions']
  activeMissions: ReturnType<typeof useMissions>['activeMissions']
  dispatchMission: ReturnType<typeof useMissions>['dispatchMission']
  galaxyMap: ReturnType<typeof usePlanet>['galaxyMap']
  technologies: ReturnType<typeof usePlanet>['technologies']
  researchQueue: ReturnType<typeof usePlanet>['researchQueue']
  refetch: () => Promise<void>
}
