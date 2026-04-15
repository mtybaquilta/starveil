import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ResearchQueueItem } from './usePlanet'

export function useResearchQueue(
  planetId: string | undefined,
  queue: ResearchQueueItem[],
  onResearchComplete: () => Promise<void>
) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [activeResearch, setActiveResearch] = useState<ResearchQueueItem | null>(null)
  const completingRef = useRef(false)

  useEffect(() => {
    if (completingRef.current) return
    if (queue.length > 0) {
      setActiveResearch(queue[0])
    } else {
      setActiveResearch(null)
      setTimeRemaining(null)
    }
  }, [queue])

  const completeResearch = useCallback(async () => {
    if (!planetId) return
    completingRef.current = true
    setActiveResearch(null)
    setTimeRemaining(null)
    try {
      await supabase.functions.invoke('game-action', {
        body: { action: 'complete_research' },
      })
      await onResearchComplete()
    } catch (err) {
      console.error('Failed to complete research:', err)
    } finally {
      completingRef.current = false
    }
  }, [planetId, onResearchComplete])

  useEffect(() => {
    if (!activeResearch) return

    const interval = setInterval(() => {
      const remaining = new Date(activeResearch.completes_at).getTime() / 1000 - Date.now() / 1000
      if (remaining <= 0) {
        setTimeRemaining(0)
        clearInterval(interval)
        completeResearch()
      } else {
        setTimeRemaining(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [activeResearch, completeResearch])

  return {
    activeResearch,
    researchTimeRemaining: timeRemaining,
  }
}
