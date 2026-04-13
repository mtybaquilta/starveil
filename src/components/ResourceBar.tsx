import { useState, useEffect } from 'react'

type Props = {
  metal: number
  gas: number
  metalPerHour: number
  gasPerHour: number
  energyProduced: number
  energyConsumed: number
  planetName: string
  coordinates: string
  weatherType: string
  weatherExpiresAt: string | null
}

const WEATHER_LABELS: Record<string, string> = {
  calm_skies:      '☀ Calm Skies',
  solar_flare:     '🔆 Solar Flare',
  metal_vein:      '⛏️ Metal Vein',
  gas_pocket:      '💨 Gas Pocket',
  ion_storm:       '⚡ Ion Storm',
  dust_storm:      '🌪️ Dust Storm',
  solar_storm:     '☄️ Solar Storm',
  asteroid_shower: '🪨 Asteroid Shower',
  nebula_drift:    '🌌 Nebula Drift',
}

function formatWeatherTime(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${totalSeconds}s`
}

export function ResourceBar({
  metal,
  gas,
  metalPerHour,
  gasPerHour,
  energyProduced,
  energyConsumed,
  planetName,
  coordinates,
  weatherType,
  weatherExpiresAt,
}: Props) {
  const [weatherRemaining, setWeatherRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!weatherExpiresAt) {
      setWeatherRemaining(null)
      return
    }
    const update = () => {
      const remaining = new Date(weatherExpiresAt).getTime() - Date.now()
      setWeatherRemaining(remaining > 0 ? remaining : 0)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [weatherExpiresAt])

  return (
    <div className="flex items-center px-5 py-2.5 bg-slate-950/90 border-b border-slate-800/50">
      <div className="text-sm font-bold text-slate-100 mr-6 tracking-wide">STARVEIL: Intestellar Siege</div>

      <div className="flex gap-5 flex-1">
        <ResourceItem color="bg-orange-400" value={metal} rate={metalPerHour} textColor="text-orange-400" label="Metal" />
        <ResourceItem color="bg-violet-400" value={gas} rate={gasPerHour} textColor="text-violet-400" label="Gas" />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-green-400" />
          <span className="text-green-400 font-semibold text-sm">
            {Math.floor(energyProduced)}/{Math.floor(energyConsumed)}
          </span>
          <span className="text-slate-500 text-[10px]">energy</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-slate-500 text-xs">
        <span className="text-slate-400">
          {WEATHER_LABELS[weatherType] ?? weatherType}
          {weatherRemaining !== null && weatherRemaining > 0 && (
            <span className="text-slate-600 ml-1.5">{formatWeatherTime(weatherRemaining)}</span>
          )}
        </span>
        <span>{planetName} · {coordinates}</span>
      </div>
    </div>
  )
}

function ResourceItem({ color, value, rate, textColor, label }: {
  color: string
  value: number
  rate: number
  textColor: string
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-sm ${color}`} />
      <span className={`font-semibold text-sm ${textColor}`}>
        {Math.floor(value).toLocaleString()}
      </span>
      <span className="text-slate-500 text-[10px]">+{Math.floor(rate).toLocaleString()}/h</span>
      <span className="sr-only">{label}</span>
    </div>
  )
}
