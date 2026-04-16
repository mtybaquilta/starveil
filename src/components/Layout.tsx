import { Outlet } from 'react-router-dom'
import { ResourceBar } from './ResourceBar'
import { QueueStrip } from './QueueStrip'
import { Sidebar } from './Sidebar'
import { AchievementToast } from './AchievementToast'
import { PlanetSelector } from './PlanetSelector'
import { usePlanets } from '../hooks/usePlanets'
import { usePlanet } from '../hooks/usePlanet'
import { useResources } from '../hooks/useResources'
import { useConstructionQueue } from '../hooks/useConstructionQueue'
import { useShipQueue } from '../hooks/useShipQueue'
import { useMissions } from '../hooks/useMissions'
import { useResearchQueue } from '../hooks/useResearchQueue'
import { useWeather } from '../hooks/useWeather'
import { useAttacks } from '../hooks/useAttacks'

export function Layout() {
  const { planets, selectedPlanetId, selectPlanet, refetchPlanets } = usePlanets()
  const {
    planet, buildings, constructionQueue, shipFleet, shipQueue,
    missions, completedMissions, galaxyMap, technologies, researchQueue,
    weather, events, achievements,
    outgoingAttacks: outgoingAttacksRaw, incomingAttacks: incomingAttacksRaw,
    loading, refetch,
  } = usePlanet(selectedPlanetId)
  const resources = useResources(planet, buildings, weather, technologies)
  const { activeBuild, timeRemaining, startBuild } = useConstructionQueue(
    planet?.id,
    constructionQueue,
    refetch
  )
  const { activeShipBuild, shipTimeRemaining, shipQueue: shipBuildQueue, startShipBuild } = useShipQueue(
    planet?.id,
    shipQueue,
    refetch
  )
  const { activeMissions, dispatchMission } = useMissions(
    planet?.id,
    missions,
    refetch
  )
  const { activeResearch, researchTimeRemaining } = useResearchQueue(
    planet?.id,
    researchQueue,
    refetch
  )
  useWeather(planet?.id, weather, refetch)
  const { outgoingAttacks, incomingAttacks, dispatchAttack } = useAttacks(
    planet?.id,
    outgoingAttacksRaw,
    incomingAttacksRaw,
    async () => { await Promise.all([refetch(), refetchPlanets()]) }
  )

  const refetchAll = async () => {
    await Promise.all([refetch(), refetchPlanets()])
  }

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
      <AchievementToast achievements={achievements} />
      <div className="flex items-center bg-slate-950/90 border-b border-slate-800/50">
        <ResourceBar
          metal={resources.metal}
          gas={resources.gas}
          metalPerHour={resources.metalPerHour}
          gasPerHour={resources.gasPerHour}
          metalBaseRate={resources.metalBaseFromBuildings}
          gasBaseRate={resources.gasBaseFromBuildings}
          metalResearchBonus={resources.metalResearchBonus}
          gasResearchBonus={resources.gasResearchBonus}
          energyProduced={resources.energyProduced}
          energyConsumed={resources.energyConsumed}
          energyRatio={resources.energyRatio}
          planetName={planet.name}
          coordinates={planet.coordinates}
          weatherType={weather?.weather_type ?? 'calm_skies'}
          weatherExpiresAt={weather?.expires_at ?? null}
          weatherMetalMultiplier={weather ? Number(weather.metal_multiplier) : 1}
          weatherGasMultiplier={weather ? Number(weather.gas_multiplier) : 1}
          weatherStationLevel={buildings.find((b) => b.building_id === 'weather_station')?.level ?? 0}
          incomingAttackCount={incomingAttacks.filter((a) => a.status === 'in_transit').length}
        />
        {planets.length > 1 && (
          <PlanetSelector
            planets={planets}
            selectedPlanetId={selectedPlanetId}
            onSelect={selectPlanet}
          />
        )}
      </div>
      <QueueStrip
        activeBuild={activeBuild}
        timeRemaining={timeRemaining}
        activeShipBuild={activeShipBuild}
        shipTimeRemaining={shipTimeRemaining}
        activeResearch={activeResearch}
        researchTimeRemaining={researchTimeRemaining}
      />
      <div className="flex flex-1">
        <Sidebar
          activeMissionCount={activeMissions.length}
          achievementCount={achievements.length}
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
              shipBuildQueue,
              startShipBuild,
              shipFleet,
              missions,
              completedMissions,
              activeMissions,
              dispatchMission,
              galaxyMap,
              technologies,
              researchQueue,
              activeResearch,
              researchTimeRemaining,
              achievements,
              outgoingAttacks,
              incomingAttacks,
              dispatchAttack,
              planets,
              selectPlanet,
              refetch: refetchAll,
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
  shipBuildQueue: ReturnType<typeof useShipQueue>['shipQueue']
  startShipBuild: ReturnType<typeof useShipQueue>['startShipBuild']
  shipFleet: ReturnType<typeof usePlanet>['shipFleet']
  missions: ReturnType<typeof usePlanet>['missions']
  completedMissions: ReturnType<typeof usePlanet>['completedMissions']
  activeMissions: ReturnType<typeof useMissions>['activeMissions']
  dispatchMission: ReturnType<typeof useMissions>['dispatchMission']
  galaxyMap: ReturnType<typeof usePlanet>['galaxyMap']
  technologies: ReturnType<typeof usePlanet>['technologies']
  researchQueue: ReturnType<typeof usePlanet>['researchQueue']
  activeResearch: ReturnType<typeof useResearchQueue>['activeResearch']
  researchTimeRemaining: ReturnType<typeof useResearchQueue>['researchTimeRemaining']
  achievements: ReturnType<typeof usePlanet>['achievements']
  outgoingAttacks: ReturnType<typeof usePlanet>['outgoingAttacks']
  incomingAttacks: ReturnType<typeof usePlanet>['incomingAttacks']
  dispatchAttack: ReturnType<typeof useAttacks>['dispatchAttack']
  planets: ReturnType<typeof usePlanets>['planets']
  selectPlanet: ReturnType<typeof usePlanets>['selectPlanet']
  refetch: () => Promise<void>
}
