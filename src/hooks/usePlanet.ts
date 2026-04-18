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

export type PlanetDefense = {
  defense_type: string
  count: number
}

export type ShipQueueItem = {
  id: string
  ship_type: string
  quantity: number
  started_at: string
  completes_at: string | null
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

export type PlayerAchievement = {
  achievement_id: string
  unlocked_at: string
}

export type PlayerAttack = {
  id: string
  attacker_id: string
  attacker_planet_id: string
  defender_id: string
  defender_planet_id: string
  fleet: Record<string, number>
  status: 'in_transit' | 'returning' | 'resolved'
  dispatched_at: string
  arrives_at: string
  return_arrives_at: string | null
  resolved_at: string | null
  result: {
    victory?: boolean
    stolen?: { metal: number; gas: number }
    surviving_fleet?: Record<string, number>
    attacker_losses?: Record<string, number>
    defender_losses?: Record<string, number>
    attacker_username?: string
    defender_username?: string
  } | null
  target_coordinates: string
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

export function usePlanet(selectedPlanetId: string | null) {
  const [planet, setPlanet] = useState<Planet | null>(null)
  const [buildings, setBuildings] = useState<PlanetBuilding[]>([])
  const [constructionQueue, setConstructionQueue] = useState<ConstructionItem[]>([])
  const [shipFleet, setShipFleet] = useState<PlanetShip[]>([])
  const [defenseFleet, setDefenseFleet] = useState<PlanetDefense[]>([])
  const [shipQueue, setShipQueue] = useState<ShipQueueItem[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [completedMissions, setCompletedMissions] = useState<Mission[]>([])
  const [galaxyMap, setGalaxyMap] = useState<GalaxyMapEntry[]>([])
  const [technologies, setTechnologies] = useState<PlayerTechnology[]>([])
  const [researchQueue, setResearchQueue] = useState<ResearchQueueItem[]>([])
  const [weather, setWeather] = useState<PlanetWeather | null>(null)
  const [events, setEvents] = useState<PlanetEvent[]>([])
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([])
  const [outgoingAttacks, setOutgoingAttacks] = useState<PlayerAttack[]>([])
  const [incomingAttacks, setIncomingAttacks] = useState<PlayerAttack[]>([])
  const [resolvedAttacks, setResolvedAttacks] = useState<PlayerAttack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!selectedPlanetId) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const playerId = sessionData.session?.user.id

      const { data: planetData, error: planetErr } = await supabase
        .from('planets')
        .select('*')
        .eq('id', selectedPlanetId)
        .eq('player_id', playerId)
        .single()

      if (planetErr) throw planetErr
      setPlanet(planetData)

      const planetId = planetData.id

      const [
        buildingsRes, queueRes, weatherRes, eventsRes,
        shipsRes, defenseFleetRes, shipQueueRes, missionsRes, completedMissionsRes,
        galaxyRes, techRes, researchRes, achievementsRes,
        outgoingAttacksRes, incomingAttacksRes, resolvedAttacksRes,
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
          .from('planet_defenses')
          .select('defense_type, count')
          .eq('planet_id', planetId),
        supabase
          .from('ship_queue')
          .select('*')
          .eq('planet_id', planetId)
          .order('started_at', { ascending: true }),
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
        supabase
          .from('player_achievements')
          .select('achievement_id, unlocked_at')
          .eq('player_id', playerId),
        supabase
          .from('player_attacks')
          .select('*')
          .eq('attacker_id', playerId)
          .neq('status', 'resolved')
          .order('dispatched_at', { ascending: false }),
        supabase
          .from('player_attacks')
          .select('*')
          .eq('defender_id', playerId)
          .neq('status', 'resolved')
          .order('dispatched_at', { ascending: false }),
        supabase
          .from('player_attacks')
          .select('*')
          .or(`attacker_id.eq.${playerId},defender_id.eq.${playerId}`)
          .eq('status', 'resolved')
          .order('resolved_at', { ascending: false })
          .limit(50),
      ])

      if (buildingsRes.data) setBuildings(buildingsRes.data)
      if (queueRes.data) setConstructionQueue(queueRes.data)
      if (weatherRes.data) setWeather(weatherRes.data)
      if (eventsRes.data) setEvents(eventsRes.data)
      if (shipsRes.data) setShipFleet(shipsRes.data)
      if (defenseFleetRes.data) setDefenseFleet(defenseFleetRes.data)
      if (shipQueueRes.data) setShipQueue(shipQueueRes.data)
      if (missionsRes.data) setMissions(missionsRes.data)
      if (completedMissionsRes.data) setCompletedMissions(completedMissionsRes.data)
      if (galaxyRes.data) setGalaxyMap(galaxyRes.data)
      if (techRes.data) setTechnologies(techRes.data)
      if (researchRes.data) setResearchQueue(researchRes.data)
      if (achievementsRes.data) setAchievements(achievementsRes.data)
      setOutgoingAttacks(outgoingAttacksRes.data ?? [])
      setIncomingAttacks(incomingAttacksRes.data ?? [])
      setResolvedAttacks(resolvedAttacksRes.data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [selectedPlanetId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return {
    planet,
    buildings,
    constructionQueue,
    shipFleet,
    defenseFleet,
    shipQueue,
    missions,
    completedMissions,
    galaxyMap,
    technologies,
    researchQueue,
    weather,
    events,
    achievements,
    outgoingAttacks,
    incomingAttacks,
    resolvedAttacks,
    loading,
    error,
    refetch: fetchAll,
  }
}
