import { useEffect, useState, useRef } from 'react'
import { getAchievementConfig } from '../config/achievements'
import type { PlayerAchievement } from '../hooks/usePlanet'

type ToastItem = {
  id: string
  name: string
  description: string
}

export function AchievementToast({ achievements }: { achievements: PlayerAchievement[] }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const prevCountRef = useRef(achievements.length)

  useEffect(() => {
    const prevCount = prevCountRef.current
    prevCountRef.current = achievements.length

    // Only show toasts when count increases (not on initial load)
    if (prevCount === 0 || achievements.length <= prevCount) return

    // Find newly unlocked achievements (the ones we didn't have before)
    const newOnes = achievements
      .slice(-achievements.length + prevCount)
      .map((a) => {
        const config = getAchievementConfig(a.achievement_id)
        if (!config) return null
        return { id: config.id, name: config.name, description: config.description }
      })
      .filter(Boolean) as ToastItem[]

    if (newOnes.length === 0) return

    setToasts((prev) => [...prev, ...newOnes])

    // Auto-dismiss after 5 seconds
    const timeout = setTimeout(() => {
      setToasts((prev) => prev.slice(newOnes.length))
    }, 5000)

    return () => clearTimeout(timeout)
  }, [achievements])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast, i) => (
        <div
          key={`${toast.id}-${i}`}
          className="bg-slate-800 border border-amber-500/40 rounded-lg px-4 py-3 shadow-lg shadow-amber-500/10 animate-slide-in max-w-xs"
        >
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
            Achievement Unlocked!
          </div>
          <div className="text-sm font-semibold text-slate-100 mt-0.5">{toast.name}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{toast.description}</div>
        </div>
      ))}
    </div>
  )
}
