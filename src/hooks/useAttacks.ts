import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { IS_DEV_MODE } from '../lib/devMode'
import type { PlayerAttack } from './usePlanet'

export function useAttacks(
  planetId: string | undefined,
  outgoingAttacks: PlayerAttack[],
  incomingAttacks: PlayerAttack[],
  onComplete: () => void
) {
  const resolvingRef = useRef<Set<string>>(new Set())
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const planetIdRef = useRef(planetId)
  planetIdRef.current = planetId

  useEffect(() => {
    const allAttacks = [...outgoingAttacks, ...incomingAttacks]
    if (allAttacks.length === 0) return

    const resolveAttack = async (attackId: string, action: string) => {
      if (!planetIdRef.current || resolvingRef.current.has(attackId)) return
      resolvingRef.current.add(attackId)
      try {
        await supabase.functions.invoke('game-action', {
          body: { action, planetId: planetIdRef.current, attackId, devMode: IS_DEV_MODE },
        })
        onCompleteRef.current()
      } catch (err) {
        console.error(`Failed to ${action}:`, err)
        resolvingRef.current.delete(attackId)
      }
    }

    const interval = setInterval(() => {
      const now = Date.now()
      for (const attack of allAttacks) {
        if (attack.status === 'in_transit' && new Date(attack.arrives_at).getTime() <= now) {
          resolveAttack(attack.id, 'resolve_attack')
        } else if (attack.status === 'returning' && attack.return_arrives_at && new Date(attack.return_arrives_at).getTime() <= now) {
          resolveAttack(attack.id, 'return_fleet')
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [outgoingAttacks, incomingAttacks])

  const dispatchAttack = useCallback(
    async (fleet: Record<string, number>, targetCoords: string, devMode: boolean) => {
      if (!planetIdRef.current) return
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'attack_player', planetId: planetIdRef.current, fleet, targetCoords, devMode },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      onCompleteRef.current()
      return data
    },
    []
  )

  return { outgoingAttacks, incomingAttacks, dispatchAttack }
}
