export function calculateEnergyRatio(
  energyProduced: number,
  energyConsumed: number
): number {
  if (energyConsumed <= 0) return 1
  if (energyProduced <= 0) return 0
  return Math.min(1, energyProduced / energyConsumed)
}

type ResourceCalcInput = {
  metalAmount: number
  gasAmount: number
  lastCalculatedAt: Date
  now: Date
  metalPerHour: number
  gasPerHour: number
  energyRatio: number
  metalStorageCap: number
  gasStorageCap: number
  weatherMetalMultiplier: number
  weatherGasMultiplier: number
}

export function calculateResources(input: ResourceCalcInput) {
  const elapsedHours =
    (input.now.getTime() - input.lastCalculatedAt.getTime()) / (1000 * 3600)

  const metalProduced =
    input.metalPerHour * input.energyRatio * input.weatherMetalMultiplier * elapsedHours
  const gasProduced =
    input.gasPerHour * input.energyRatio * input.weatherGasMultiplier * elapsedHours

  const metal = Math.min(input.metalAmount + metalProduced, input.metalStorageCap)
  const gas = Math.min(input.gasAmount + gasProduced, input.gasStorageCap)

  return { metal, gas }
}
