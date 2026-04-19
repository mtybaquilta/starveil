import { useEffect, useState } from 'react'
import { useApexEvent } from '../hooks/useApexEvent'
import { getBossConfig } from '../config/bosses'

export function ApexEventBanner() {
  const { event, metadata } = useApexEvent()
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!event) return
    const i = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(i)
  }, [event])

  if (!event) return null
  let boss
  try {
    boss = getBossConfig(event.boss_id)
  } catch {
    return null
  }
  const now = Date.now()
  const targetMs =
    event.phase === 'heralded'
      ? new Date(event.activates_at).getTime()
      : new Date(event.expires_at).getTime()
  const remainingSec = Math.max(0, Math.floor((targetMs - now) / 1000))
  const h = Math.floor(remainingSec / 3600)
  const m = Math.floor((remainingSec % 3600) / 60)
  const s = remainingSec % 60
  const timeStr = `${h}h ${m}m ${s}s`
  const hp = metadata?.hp_remaining
  const hpMax = metadata?.hp_max

  return (
    <div
      className={`w-full px-4 py-2 text-xs font-medium border-b ${
        event.phase === 'heralded'
          ? 'bg-fuchsia-900/40 border-fuchsia-500/40 text-fuchsia-200 animate-pulse'
          : 'bg-fuchsia-900/60 border-fuchsia-500/60 text-fuchsia-100'
      }`}
    >
      {event.phase === 'heralded'
        ? `⚠ ${boss.name} approaches. Prepare. Arrival in ${timeStr}.`
        : `⚔ ${boss.name} is active — HP ${hp}/${hpMax} — escapes in ${timeStr}.`}
    </div>
  )
}
