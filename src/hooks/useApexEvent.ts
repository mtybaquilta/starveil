import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type ApexEvent = {
  id: string
  boss_id: string
  phase: 'heralded' | 'active' | 'killed' | 'escaped'
  heralded_at: string
  activates_at: string
  expires_at: string
  resolved_at: string | null
  galaxy_map_id: string
}

export function useApexEvent() {
  const [event, setEvent] = useState<ApexEvent | null>(null)
  const [metadata, setMetadata] = useState<Record<string, any> | null>(null)
  const transitioningRef = useRef<Set<string>>(new Set())

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from('apex_boss_events')
      .select('*')
      .in('phase', ['heralded', 'active'])
      .order('heralded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setEvent(data as ApexEvent | null)
    if (data) {
      const { data: anchor } = await supabase
        .from('galaxy_map')
        .select('metadata')
        .eq('id', data.galaxy_map_id)
        .maybeSingle()
      setMetadata((anchor?.metadata ?? null) as Record<string, any> | null)
    } else {
      setMetadata(null)
    }
  }, [])

  useEffect(() => {
    refetch()
    const poll = setInterval(refetch, 15000)
    return () => clearInterval(poll)
  }, [refetch])

  useEffect(() => {
    if (!event) return
    const tick = setInterval(async () => {
      const now = Date.now()
      const key = `${event.id}:${event.phase}`
      if (transitioningRef.current.has(key)) return
      if (event.phase === 'heralded' && new Date(event.activates_at).getTime() <= now) {
        transitioningRef.current.add(key)
        try {
          await supabase.functions.invoke('game-action', {
            body: { action: 'activate_apex_event', eventId: event.id },
          })
          await refetch()
        } finally {
          transitioningRef.current.delete(key)
        }
      } else if (event.phase === 'active' && new Date(event.expires_at).getTime() <= now) {
        transitioningRef.current.add(key)
        try {
          await supabase.functions.invoke('game-action', {
            body: { action: 'resolve_apex_event', eventId: event.id },
          })
          await refetch()
        } finally {
          transitioningRef.current.delete(key)
        }
      }
    }, 2000)
    return () => clearInterval(tick)
  }, [event, refetch])

  return { event, metadata, refetch }
}
