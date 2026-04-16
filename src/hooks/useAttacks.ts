import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PlayerAttack } from './usePlanet'

export function useAttacks(
  planetId: string | undefined,
  outgoingAttacks: PlayerAttack[],
  incomingAttacks: PlayerAttack[],
  onComplete: () => void
) {
  const resolvingRef = useRef<Set<string>>(new Set())

  const resolveAttack = useCallback(async (attackId: string, action: string) => {
    if (!planetId || resolvingRef.current.has(attackId)) return
    resolvingRef.current.add(attackId)
    try {
      await supabase.functions.invoke('game-action', {
        body: { action, planetId, attackId },
      })
      onComplete()
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    } finally {
      resolvingRef.current.delete(attackId)
    }
  }, [planetId, onComplete])

  useEffect(() => {
    const allAttacks = [...outgoingAttacks, ...incomingAttacks]
    if (allAttacks.length === 0) return

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
  }, [outgoingAttacks, incomingAttacks, resolveAttack])

  const dispatchAttack = useCallback(
    async (fleet: Record<string, number>, targetCoords: string, devMode: boolean) => {
      if (!planetId) return
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'attack_player', planetId, fleet, targetCoords, devMode },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      onComplete()
      return data
    },
    [planetId, onComplete]
  )

  return { outgoingAttacks, incomingAttacks, dispatchAttack }
}
