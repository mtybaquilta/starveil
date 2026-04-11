import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { IS_DEV_MODE } from '../lib/devMode'
import type { ConstructionItem } from './usePlanet'

export function useConstructionQueue(
  planetId: string | undefined,
  queue: ConstructionItem[],
  onBuildComplete: () => void
) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [activeBuild, setActiveBuild] = useState<ConstructionItem | null>(null)
  const completingRef = useRef(false)

  useEffect(() => {
    if (completingRef.current) return
    if (queue.length > 0) {
      setActiveBuild(queue[0])
    } else {
      setActiveBuild(null)
      setTimeRemaining(null)
    }
  }, [queue])

  const completeBuild = useCallback(async () => {
    if (!planetId || !activeBuild) return
    completingRef.current = true
    setActiveBuild(null)
    setTimeRemaining(null)
    try {
      await supabase.functions.invoke('game-action', {
        body: { action: 'complete_build', planetId },
      })
      onBuildComplete()
    } catch (err) {
      console.error('Failed to complete build:', err)
    } finally {
      completingRef.current = false
    }
  }, [planetId, activeBuild, onBuildComplete])

  useEffect(() => {
    if (!activeBuild) return

    const interval = setInterval(() => {
      const remaining = new Date(activeBuild.completes_at).getTime() - Date.now()
      if (remaining <= 0) {
        setTimeRemaining(0)
        clearInterval(interval)
        completeBuild()
      } else {
        setTimeRemaining(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [activeBuild, completeBuild])

  const startBuild = useCallback(
    async (buildingId: string) => {
      if (!planetId) return
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'start_build', planetId, buildingId, devMode: IS_DEV_MODE },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      onBuildComplete()
      return data
    },
    [planetId, onBuildComplete]
  )

  return {
    activeBuild,
    timeRemaining,
    startBuild,
  }
}

export function formatTime(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
