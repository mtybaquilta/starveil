import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getBuildingConfig } from '../config/buildings'
import { SHIPS } from '../config/ships'
import {
  productionPerHour,
  energyConsumption,
  storageCapacity,
  BASE_METAL_PRODUCTION_PER_HOUR,
  BASE_GAS_PRODUCTION_PER_HOUR,
} from '../config/formulas'
import { calculateEnergyRatio, calculateResources } from '../lib/resources'
import { getTechBonuses } from '../lib/techBonuses'

const BASE_METAL_STORAGE = 10000
const BASE_GAS_STORAGE = 10000

export type ColonyQueueSlot = {
  label: string
  completesAt: string
} | null

export type ColonySummary = {
  id: string
  name: string
  coordinates: string
  metal: number
  gas: number
  metalStorageCap: number
  gasStorageCap: number
  metalPerHour: number
  gasPerHour: number
  energyRatio: number
  weatherType: string | null
  construction: ColonyQueueSlot
  shipBuild: ColonyQueueSlot
  activeMissions: number
}

function buildingLabel(id: string, targetLevel: number): string {
  try {
    return `${getBuildingConfig(id).name} L${targetLevel}`
  } catch {
    return `${id} L${targetLevel}`
  }
}

function shipLabel(id: string, quantity: number): string {
  const cfg = SHIPS.find((s) => s.id === id)
  return `${cfg?.name ?? id} ×${quantity}`
}

export function useColonySummaries() {
  const [summaries, setSummaries] = useState<ColonySummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const playerId = sessionData.session?.user.id
    if (!playerId) {
      setLoading(false)
      return
    }

    const [{ data: planets }, { data: techs }] = await Promise.all([
      supabase
        .from('planets')
        .select('id, name, coordinates, metal_amount, gas_amount, last_calculated_at')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true }),
      supabase.from('player_technologies').select('tech_id, level').eq('player_id', playerId),
    ])

    if (!planets || planets.length === 0) {
      setSummaries([])
      setLoading(false)
      return
    }

    const techBonuses = getTechBonuses(techs ?? [])
    const ids = planets.map((p) => p.id)

    const [buildingsRes, constructionRes, shipQueueRes, weatherRes, missionsRes] = await Promise.all([
      supabase.from('planet_buildings').select('planet_id, building_id, level').in('planet_id', ids),
      supabase
        .from('construction_queue')
        .select('planet_id, building_id, target_level, completes_at')
        .in('planet_id', ids)
        .order('completes_at', { ascending: true }),
      supabase
        .from('ship_queue')
        .select('planet_id, ship_type, quantity, completes_at')
        .in('planet_id', ids)
        .order('completes_at', { ascending: true }),
      supabase
        .from('planet_weather')
        .select('planet_id, weather_type, started_at')
        .in('planet_id', ids)
        .order('started_at', { ascending: false }),
      supabase
        .from('missions')
        .select('planet_id, status')
        .in('planet_id', ids)
        .neq('status', 'completed'),
    ])

    const buildingsByPlanet = new Map<string, { building_id: string; level: number }[]>()
    for (const row of buildingsRes.data ?? []) {
      const arr = buildingsByPlanet.get(row.planet_id) ?? []
      arr.push({ building_id: row.building_id, level: row.level })
      buildingsByPlanet.set(row.planet_id, arr)
    }

    const constructionByPlanet = new Map<string, { building_id: string; target_level: number; completes_at: string }>()
    for (const row of constructionRes.data ?? []) {
      if (!constructionByPlanet.has(row.planet_id)) constructionByPlanet.set(row.planet_id, row)
    }

    const shipQueueByPlanet = new Map<string, { ship_type: string; quantity: number; completes_at: string | null }>()
    for (const row of shipQueueRes.data ?? []) {
      if (!shipQueueByPlanet.has(row.planet_id)) shipQueueByPlanet.set(row.planet_id, row)
    }

    const weatherByPlanet = new Map<string, string>()
    for (const row of weatherRes.data ?? []) {
      if (!weatherByPlanet.has(row.planet_id)) weatherByPlanet.set(row.planet_id, row.weather_type)
    }

    const missionsByPlanet = new Map<string, number>()
    for (const row of missionsRes.data ?? []) {
      missionsByPlanet.set(row.planet_id, (missionsByPlanet.get(row.planet_id) ?? 0) + 1)
    }

    const now = new Date()
    const out: ColonySummary[] = planets.map((p) => {
      const plBuildings = buildingsByPlanet.get(p.id) ?? []

      let metalPerHourBase = 0
      let gasPerHourBase = 0
      let energyProducedBase = 0
      let energyConsumed = 0
      let metalCap = BASE_METAL_STORAGE
      let gasCap = BASE_GAS_STORAGE

      for (const b of plBuildings) {
        let cfg
        try {
          cfg = getBuildingConfig(b.building_id)
        } catch {
          continue
        }
        if (b.building_id === 'metal_mine') metalPerHourBase += productionPerHour(cfg.baseProductionPerHour, b.level)
        if (b.building_id === 'gas_refinery') gasPerHourBase += productionPerHour(cfg.baseProductionPerHour, b.level)
        if (b.building_id === 'solar_array') energyProducedBase += productionPerHour(cfg.baseProductionPerHour, b.level)
        if (b.building_id === 'metal_storage') metalCap = storageCapacity(BASE_METAL_STORAGE, b.level)
        if (b.building_id === 'gas_storage') gasCap = storageCapacity(BASE_GAS_STORAGE, b.level)
        energyConsumed += energyConsumption(cfg.baseEnergyConsumption, b.level)
      }

      metalPerHourBase = Math.max(metalPerHourBase, BASE_METAL_PRODUCTION_PER_HOUR)
      gasPerHourBase = Math.max(gasPerHourBase, BASE_GAS_PRODUCTION_PER_HOUR)

      const metalPerHour = metalPerHourBase * (1 + techBonuses.metal_production)
      const gasPerHour = gasPerHourBase * (1 + techBonuses.gas_production)
      const energyProduced = energyProducedBase * (1 + techBonuses.energy_production)
      const eRatio = calculateEnergyRatio(energyProduced, energyConsumed)

      const { metal, gas } = calculateResources({
        metalAmount: p.metal_amount,
        gasAmount: p.gas_amount,
        lastCalculatedAt: new Date(p.last_calculated_at),
        now,
        metalPerHour,
        gasPerHour,
        energyRatio: eRatio,
        metalStorageCap: metalCap,
        gasStorageCap: gasCap,
        weatherMetalMultiplier: 1,
        weatherGasMultiplier: 1,
      })

      const con = constructionByPlanet.get(p.id)
      const ship = shipQueueByPlanet.get(p.id)

      return {
        id: p.id,
        name: p.name,
        coordinates: p.coordinates,
        metal,
        gas,
        metalStorageCap: metalCap,
        gasStorageCap: gasCap,
        metalPerHour: metalPerHour * eRatio,
        gasPerHour: gasPerHour * eRatio,
        energyRatio: eRatio,
        weatherType: weatherByPlanet.get(p.id) ?? null,
        construction: con
          ? { label: buildingLabel(con.building_id, con.target_level), completesAt: con.completes_at }
          : null,
        shipBuild: ship && ship.completes_at
          ? { label: shipLabel(ship.ship_type, ship.quantity), completesAt: ship.completes_at }
          : null,
        activeMissions: missionsByPlanet.get(p.id) ?? 0,
      }
    })

    setSummaries(out)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 15000)
    return () => clearInterval(id)
  }, [fetchAll])

  return { summaries, loading, refetch: fetchAll }
}
