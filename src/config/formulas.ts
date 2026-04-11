export const BASE_METAL_PRODUCTION_PER_HOUR = 10
export const BASE_GAS_PRODUCTION_PER_HOUR = 5

/** Time in seconds to build a ship at a given shipyard level. 10% faster per level, min 5% of base. */
export function shipBuildTimeSeconds(baseBuildTimeSeconds: number, shipyardLevel: number): number {
  const factor = Math.pow(0.9, shipyardLevel)
  return baseBuildTimeSeconds * Math.max(factor, 0.05)
}

/** Production per hour for resource buildings. Returns 0 for level 0. */
export function productionPerHour(baseRate: number, level: number): number {
  if (level <= 0) return 0
  return baseRate * level * Math.pow(1.1, level)
}

/** Cost to upgrade to the given level. */
export function upgradeCost(baseCost: number, level: number): number {
  return baseCost * Math.pow(1.6, level)
}

/** Time in seconds to build/upgrade to the given level. */
export function buildTimeSeconds(baseTime: number, level: number): number {
  return baseTime * Math.pow(1.5, level)
}

/** Energy consumed by a building at a given level. Returns 0 for level 0 or base 0. */
export function energyConsumption(baseEnergy: number, level: number): number {
  if (level <= 0 || baseEnergy === 0) return 0
  return baseEnergy * level * Math.pow(1.1, level)
}

/** Storage capacity at a given level. Level 0 returns base capacity. */
export function storageCapacity(baseCapacity: number, level: number): number {
  if (level <= 0) return baseCapacity
  return baseCapacity * Math.pow(1.5, level)
}

/** Travel time in seconds. Distance is system-unit difference, speed is fleet's slowest ship. */
export function travelTimeSeconds(distance: number, fleetSpeed: number): number {
  if (fleetSpeed <= 0) return Infinity
  return Math.ceil((distance / fleetSpeed) * 60)
}

/** Resource yield from a mining run. Based on total miningYield * richness * duration in minutes. */
export function miningReward(totalMiningYield: number, richness: number, durationMinutes: number): { metal: number; gas: number } {
  const base = totalMiningYield * richness * durationMinutes
  return { metal: Math.floor(base * 1.0), gas: Math.floor(base * 0.4) }
}
