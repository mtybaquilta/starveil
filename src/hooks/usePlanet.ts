import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type PlanetBuilding = {
  building_id: string
  level: number
}

export type ConstructionItem = {
  id: string
  building_id: string
  target_level: number
  started_at: string
  completes_at: string
}

export type PlanetShip = {
  ship_type: string
  count: number
}

export type ShipQueueItem = {
  id: string
  ship_type: string
  quantity: number
  started_at: string
  completes_at: string
}

export type Mission = {
  id: string
  mission_type: string
  status: string
  target_coords: string
  target_name: string
  fleet: Record<string, number>
  dispatched_at: string
  arrives_at: string
  returns_at: string
  result: MissionResult | null
}

export type MissionResult = {
  rewards?: { metal?: number; gas?: number }
  combat_log?: unknown[]
  ships_lost?: Record<string, number>
  encounter_type?: string
}

export type GalaxyMapEntry = {
  id: string
  coordinates: string
  visibility: 'detected' | 'revealed'
  location_type: string | null
  name: string | null
  metadata: Record<string, unknown>
  detected_at: string
  revealed_at: string | null
  cleared_at: string | null
  respawns_at: string | null
}

export type PlayerTechnology = {
  tech_id: string
  level: number
}

export type ResearchQueueItem = {
  id: string
  tech_id: string
  target_level: number
  started_at: string
  completes_at: string
}

export type PlanetWeather = {
  weather_type: string
  metal_multiplier: number
  gas_multiplier: number
  energy_multiplier: number
  started_at: string
  expires_at: string | null
}

export type PlanetEvent = {
  id: string
  event_type: string
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

export type Planet = {
  id: string
  name: string
  coordinates: string
  diameter: number
  max_building_slots: number
  metal_amount: number
  gas_amount: number
  last_calculated_at: string
}

export function usePlanet() {
  const [planet, setPlanet] = useState<Planet | null>(null)
  const [buildings, setBuildings] = useState<PlanetBuilding[]>([])
  const [constructionQueue, setConstructionQueue] = useState<ConstructionItem[]>([])
  const [shipFleet, setShipFleet] = useState<PlanetShip[]>([])
  const [shipQueue, setShipQueue] = useState<ShipQueueItem[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [completedMissions, setCompletedMissions] = useState<Mission[]>([])
  const [galaxyMap, setGalaxyMap] = useState<GalaxyMapEntry[]>([])
  const [technologies, setTechnologies] = useState<PlayerTechnology[]>([])
  const [researchQueue, setResearchQueue] = useState<ResearchQueueItem[]>([])
  const [weather, setWeather] = useState<PlanetWeather | null>(null)
  const [events, setEvents] = useState<PlanetEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const playerId = sessionData.session?.user.id

      const { data: planets, error: planetErr } = await supabase
        .from('planets')
        .select('*')
        .limit(1)
        .single()

      if (planetErr) throw planetErr
      setPlanet(planets)

      const planetId = planets.id

      const [
        buildingsRes, queueRes, weatherRes, eventsRes,
        shipsRes, shipQueueRes, missionsRes, completedMissionsRes,
        galaxyRes, techRes, researchRes,
      ] = await Promise.all([
        supabase
          .from('planet_buildings')
          .select('building_id, level')
          .eq('planet_id', planetId),
        supabase
          .from('construction_queue')
          .select('*')
          .eq('planet_id', planetId),
        supabase
          .from('planet_weather')
          .select('*')
          .eq('planet_id', planetId)
          .order('started_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('planet_events')
          .select('*')
          .eq('planet_id', planetId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('planet_ships')
          .select('ship_type, count')
          .eq('planet_id', planetId),
        supabase
          .from('ship_queue')
          .select('*')
          .eq('planet_id', planetId),
        supabase
          .from('missions')
          .select('*')
          .eq('planet_id', planetId)
          .neq('status', 'completed')
          .order('dispatched_at', { ascending: false }),
        supabase
          .from('missions')
          .select('*')
          .eq('planet_id', planetId)
          .eq('status', 'completed')
          .order('returns_at', { ascending: false })
          .limit(20),
        supabase
          .from('galaxy_map')
          .select('*')
          .eq('player_id', playerId),
        supabase
          .from('player_technologies')
          .select('tech_id, level')
          .eq('player_id', playerId),
        supabase
          .from('research_queue')
          .select('*')
          .eq('player_id', playerId),
      ])

      if (buildingsRes.data) setBuildings(buildingsRes.data)
      if (queueRes.data) setConstructionQueue(queueRes.data)
      if (weatherRes.data) setWeather(weatherRes.data)
      if (eventsRes.data) setEvents(eventsRes.data)
      if (shipsRes.data) setShipFleet(shipsRes.data)
      if (shipQueueRes.data) setShipQueue(shipQueueRes.data)
      if (missionsRes.data) setMissions(missionsRes.data)
      if (completedMissionsRes.data) setCompletedMissions(completedMissionsRes.data)
      if (galaxyRes.data) setGalaxyMap(galaxyRes.data)
      if (techRes.data) setTechnologies(techRes.data)
      if (researchRes.data) setResearchQueue(researchRes.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return {
    planet,
    buildings,
    constructionQueue,
    shipFleet,
    shipQueue,
    missions,
    completedMissions,
    galaxyMap,
    technologies,
    researchQueue,
    weather,
    events,
    loading,
    error,
    refetch: fetchAll,
  }
}
