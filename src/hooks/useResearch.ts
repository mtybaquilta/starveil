import { usePlanet, PlayerTechnology, ResearchQueueItem } from './usePlanet'
import { getTechConfig, researchCost, researchTimeSeconds } from '../config/technologies'

export function useResearch() {
  const { technologies, researchQueue, buildings, refetch } = usePlanet()

  const labLevel = buildings.find((b) => b.building_id === 'research_lab')?.level ?? 0

  const getTechLevel = (techId: string): number => {
    return technologies.find((t) => t.tech_id === techId)?.level ?? 0
  }

  const activeResearch: ResearchQueueItem | null = researchQueue[0] ?? null

  const canResearch = (techId: string): { ok: boolean; reason?: string } => {
    if (activeResearch) return { ok: false, reason: 'Research already in progress' }

    const config = getTechConfig(techId)
    const currentLevel = getTechLevel(techId)

    if (currentLevel >= config.maxLevel) return { ok: false, reason: 'Max level reached' }
    if (labLevel < config.requiredLabLevel) return { ok: false, reason: `Requires Research Lab level ${config.requiredLabLevel}` }

    for (const prereq of config.prerequisites) {
      if (getTechLevel(prereq.techId) < prereq.level) {
        return { ok: false, reason: `Requires ${prereq.techId} level ${prereq.level}` }
      }
    }

    return { ok: true }
  }

  const getCostForNextLevel = (techId: string) => {
    const config = getTechConfig(techId)
    const nextLevel = getTechLevel(techId) + 1
    return researchCost(config.baseCost, nextLevel)
  }

  const getTimeForNextLevel = (techId: string): number => {
    const config = getTechConfig(techId)
    const nextLevel = getTechLevel(techId) + 1
    return researchTimeSeconds(config.baseTimeSeconds, nextLevel)
  }

  return {
    technologies,
    activeResearch,
    labLevel,
    getTechLevel,
    canResearch,
    getCostForNextLevel,
    getTimeForNextLevel,
    refetch,
  }
}
