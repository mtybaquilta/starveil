import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { IS_DEV_MODE } from '../lib/devMode'
import type { Mission } from './usePlanet'

export function useMissions(
  planetId: string | undefined,
  missions: Mission[],
  onComplete: () => void
) {
  const resolvingRef = useRef<Set<string>>(new Set())

  const resolveMission = useCallback(async (missionId: string) => {
    if (!planetId || resolvingRef.current.has(missionId)) return
    resolvingRef.current.add(missionId)
    try {
      await supabase.functions.invoke('game-action', {
        body: { action: 'resolve_mission', planetId, missionId },
      })
      onComplete()
    } catch (err) {
      console.error('Failed to resolve mission:', err)
    } finally {
      resolvingRef.current.delete(missionId)
    }
  }, [planetId, onComplete])

  useEffect(() => {
    if (missions.length === 0) return

    const interval = setInterval(() => {
      const now = Date.now()
      for (const mission of missions) {
        if (mission.status !== 'completed' && new Date(mission.returns_at).getTime() <= now) {
          resolveMission(mission.id)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [missions, resolveMission])

  const dispatchMission = useCallback(
    async (missionType: string, fleet: Record<string, number>, targetCoords: string) => {
      if (!planetId) return
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'dispatch_mission', planetId, missionType, fleet, targetCoords, devMode: IS_DEV_MODE },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      onComplete()
      return data
    },
    [planetId, onComplete]
  )

  const generateSectors = useCallback(async () => {
    if (!planetId) return
    const { data, error } = await supabase.functions.invoke('game-action', {
      body: { action: 'generate_sectors', planetId },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    onComplete()
  }, [planetId, onComplete])

  const activeMissions = missions.filter((m) => m.status !== 'completed')

  return {
    activeMissions,
    dispatchMission,
    generateSectors,
  }
}
