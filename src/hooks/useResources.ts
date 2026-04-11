import { useState, useEffect, useRef } from 'react'
import { calculateResources, calculateEnergyRatio } from '../lib/resources'
import { productionPerHour, energyConsumption, storageCapacity, BASE_METAL_PRODUCTION_PER_HOUR, BASE_GAS_PRODUCTION_PER_HOUR } from '../config/formulas'
import { getBuildingConfig } from '../config/buildings'
import type { Planet, PlanetBuilding, PlanetWeather } from './usePlanet'

type ResourceState = {
  metal: number
  gas: number
  metalPerHour: number
  gasPerHour: number
  energyProduced: number
  energyConsumed: number
  energyRatio: number
  metalStorageCap: number
  gasStorageCap: number
}

const BASE_METAL_STORAGE = 10000
const BASE_GAS_STORAGE = 10000

export function useResources(
  planet: Planet | null,
  buildings: PlanetBuilding[],
  weather: PlanetWeather | null
): ResourceState {
  const [resources, setResources] = useState<ResourceState>({
    metal: 0,
    gas: 0,
    metalPerHour: 0,
    gasPerHour: 0,
    energyProduced: 0,
    energyConsumed: 0,
    energyRatio: 1,
    metalStorageCap: BASE_METAL_STORAGE,
    gasStorageCap: BASE_GAS_STORAGE,
  })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!planet || buildings.length === 0) return

    const buildingMap = new Map(buildings.map((b) => [b.building_id, b.level]))

    let metalPerHour = 0
    let gasPerHour = 0
    let energyProduced = 0
    let energyConsumed = 0
    let metalCap = BASE_METAL_STORAGE
    let gasCap = BASE_GAS_STORAGE

    for (const [id, level] of buildingMap) {
      const config = getBuildingConfig(id)
      if (id === 'metal_mine') metalPerHour += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'gas_refinery') gasPerHour += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'solar_array') energyProduced += productionPerHour(config.baseProductionPerHour, level)
      if (id === 'metal_storage') metalCap = storageCapacity(BASE_METAL_STORAGE, level)
      if (id === 'gas_storage') gasCap = storageCapacity(BASE_GAS_STORAGE, level)
      energyConsumed += energyConsumption(config.baseEnergyConsumption, level)
    }

    metalPerHour = Math.max(metalPerHour, BASE_METAL_PRODUCTION_PER_HOUR)
    gasPerHour = Math.max(gasPerHour, BASE_GAS_PRODUCTION_PER_HOUR)

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
        energyProduced,
        energyConsumed,
        energyRatio: eRatio,
        metalStorageCap: metalCap,
        gasStorageCap: gasCap,
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [planet, buildings, weather])

  return resources
}
