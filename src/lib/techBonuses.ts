import { TECHNOLOGIES } from '../config/technologies'

export type TechBonusMap = {
  metal_production: number
  gas_production: number
  energy_production: number
  ship_attack: number
  ship_defense: number
  mining_yield: number
  storage_capacity: number
}

export function getTechBonuses(technologies: { tech_id: string; level: number }[]): TechBonusMap {
  const result: TechBonusMap = {
    metal_production: 0,
    gas_production: 0,
    energy_production: 0,
    ship_attack: 0,
    ship_defense: 0,
    mining_yield: 0,
    storage_capacity: 0,
  }

  for (const { tech_id, level } of technologies) {
    if (level <= 0) continue
    const config = TECHNOLOGIES.find((t) => t.id === tech_id)
    if (!config) continue
    for (const bonus of config.bonuses) {
      if (bonus.type !== 'percentage') continue
      const stat = bonus.stat as keyof TechBonusMap
      if (stat in result) {
        result[stat] += (bonus.valuePerLevel / 100) * level
      }
    }
  }

  return result
}
