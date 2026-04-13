import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { IS_DEV_MODE } from '../lib/devMode'
import { formatTime } from './useConstructionQueue'
import type { ShipQueueItem } from './usePlanet'

export { formatTime }

export function useShipQueue(
  planetId: string | undefined,
  queue: ShipQueueItem[],
  onBuildComplete: () => Promise<void>
) {
  const [shipTimeRemaining, setShipTimeRemaining] = useState<number | null>(null)
  const [activeShipBuild, setActiveShipBuild] = useState<ShipQueueItem | null>(null)
  const completingRef = useRef(false)

  useEffect(() => {
    if (completingRef.current) return
    const active = queue.find((item) => item.completes_at !== null) ?? null
    setActiveShipBuild(active)
    if (!active) setShipTimeRemaining(null)
  }, [queue])

  const completeShipBuild = useCallback(async () => {
    if (!planetId || !activeShipBuild) return
    completingRef.current = true
    setActiveShipBuild(null)
    setShipTimeRemaining(null)
    try {
      await supabase.functions.invoke('game-action', {
        body: { action: 'complete_ship_build', planetId },
      })
      await onBuildComplete()
    } catch (err) {
      console.error('Failed to complete ship build:', err)
    } finally {
      completingRef.current = false
    }
  }, [planetId, activeShipBuild, onBuildComplete])

  useEffect(() => {
    if (!activeShipBuild?.completes_at) return

    const interval = setInterval(() => {
      const remaining = new Date(activeShipBuild.completes_at!).getTime() - Date.now()
      if (remaining <= 0) {
        setShipTimeRemaining(0)
        clearInterval(interval)
        completeShipBuild()
      } else {
        setShipTimeRemaining(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [activeShipBuild, completeShipBuild])

  const startShipBuild = useCallback(
    async (shipType: string, quantity: number) => {
      if (!planetId) return
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'start_ship_build', planetId, shipType, quantity, devMode: IS_DEV_MODE },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      await onBuildComplete()
      return data
    },
    [planetId, onBuildComplete]
  )

  return {
    activeShipBuild,
    shipTimeRemaining,
    shipQueue: queue,
    startShipBuild,
  }
}
