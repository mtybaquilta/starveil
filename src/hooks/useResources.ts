import { useState, useEffect, useRef } from 'react'
import { calculateResources, calculateEnergyRatio } from '../lib/resources'
import { productionPerHour, energyConsumption, storageCapacity, BASE_METAL_PRODUCTION_PER_HOUR, BASE_GAS_PRODUCTION_PER_HOUR } from '../config/formulas'
import { getBuildingConfig } from '../config/buildings'
import { getTechBonuses } from '../lib/techBonuses'
import type { Planet, PlanetBuilding, PlanetWeather, PlayerTechnology } from './usePlanet'

type ResourceState = {
  metal: number
  gas: number
  metalPerHour: number
  gasPerHour: number
  metalBaseFromBuildings: number
  gasBaseFromBuildings: number
  energyProduced: number
  energyConsumed: number
  energyRatio: number
  metalStorageCap: number
  gasStorageCap: number
  metalResearchBonus: number
  gasResearchBonus: number
  energyResearchBonus: number
}

const BASE_METAL_STORAGE = 10000
const BASE_GAS_STORAGE = 10000

export function useResources(
  planet: Planet | null,
  buildings: PlanetBuilding[],
  weather: PlanetWeather | null,
  technologies: PlayerTechnology[]
): ResourceState {
  const [resources, setResources] = useState<ResourceState>({
    metal: 0,
    gas: 0,
    metalPerHour: 0,
    gasPerHour: 0,
    metalBaseFromBuildings: 0,
    gasBaseFromBuildings: 0,
    energyProduced: 0,
    energyConsumed: 0,
    energyRatio: 1,
    metalStorageCap: BASE_METAL_STORAGE,
    gasStorageCap: BASE_GAS_STORAGE,
    metalResearchBonus: 0,
    gasResearchBonus: 0,
    energyResearchBonus: 0,
  })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!planet || buildings.length === 0) return

    const buildingMap = new Map(buildings.map((b) => [b.building_id, b.level]))
    const techBonuses = getTechBonuses(technologies)

    let metalPerHourBase = 0
    let gasPerHourBase = 0
    let energyProducedBase = 0
    let energyConsumed = 0
    let metalCap = BASE_METAL_STORAGE
    let gasCap = BASE_GAS_STORAGE

    for (const [id, level] of buildingMap) {
      const config = getBuildingConfig(id)
      if (id === 'metal_mine') metalPerHourBase += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'gas_refinery') gasPerHourBase += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'solar_array') energyProducedBase += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'metal_storage') metalCap = storageCapacity(BASE_METAL_STORAGE, level)
      if (id === 'gas_storage') gasCap = storageCapacity(BASE_GAS_STORAGE, level)
      energyConsumed += energyConsumption(config.baseEnergyConsumption, level)
    }

    metalPerHourBase = Math.max(metalPerHourBase, BASE_METAL_PRODUCTION_PER_HOUR)
    gasPerHourBase = Math.max(gasPerHourBase, BASE_GAS_PRODUCTION_PER_HOUR)

    // Apply research bonuses
    const metalPerHour = metalPerHourBase * (1 + techBonuses.metal_production)
    const gasPerHour = gasPerHourBase * (1 + techBonuses.gas_production)
    const energyProduced = energyProducedBase * (1 + techBonuses.energy_production)

    const eRatio = calculateEnergyRatio(energyProduced, energyConsumed)
    const weatherMetalMult = weather ? Number(weather.metal_multiplier) : 1
    const weatherGasMult = weather ? Number(weather.gas_multiplier) : 1

    function tick() {
      const { metal, gas } = calculateResources({
        metalAmount: planet!.metal_amount,
        gasAmount: planet!.gas_amount,
        lastCalculatedAt: new Date(planet!.last_calculated_at),
        now: new Date(),
        metalPerHour,
        gasPerHour,
        energyRatio: eRatio,
        metalStorageCap: metalCap,
        gasStorageCap: gasCap,
        weatherMetalMultiplier: weatherMetalMult,
        weatherGasMultiplier: weatherGasMult,
      })

      setResources({
        metal,
        gas,
        metalPerHour: metalPerHour * eRatio * weatherMetalMult,
        gasPerHour: gasPerHour * eRatio * weatherGasMult,
        metalBaseFromBuildings: metalPerHourBase,
        gasBaseFromBuildings: gasPerHourBase,
        energyProduced,
        energyConsumed,
        energyRatio: eRatio,
        metalStorageCap: metalCap,
        gasStorageCap: gasCap,
        metalResearchBonus: techBonuses.metal_production,
        gasResearchBonus: techBonuses.gas_production,
        energyResearchBonus: techBonuses.energy_production,
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [planet, buildings, weather, technologies])

  return resources
}
