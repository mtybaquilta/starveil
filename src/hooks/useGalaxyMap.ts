import { usePlanet } from './usePlanet'
import type { GalaxyMapEntry } from './usePlanet'

export function useGalaxyMap() {
  const { galaxyMap, buildings, refetch } = usePlanet()

  const radarLevel = buildings.find((b) => b.building_id === 'radar_array')?.level ?? 0

  const detected: GalaxyMapEntry[] = galaxyMap.filter((e) => e.visibility === 'detected')
  const revealed: GalaxyMapEntry[] = galaxyMap.filter((e) => e.visibility === 'revealed')

  /** Revealed locations that have active content (not cleared or past respawn) */
  const activeLocations: GalaxyMapEntry[] = revealed.filter((e) => {
    if (!e.cleared_at) return true
    if (e.respawns_at && new Date(e.respawns_at) <= new Date()) return true
    return false
  })

  const getEntry = (coordinates: string): GalaxyMapEntry | undefined =>
    galaxyMap.find((e) => e.coordinates === coordinates)

  return {
    galaxyMap,
    detected,
    revealed,
    activeLocations,
    radarLevel,
    getEntry,
    refetch,
  }
}
