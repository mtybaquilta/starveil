import { useState, useEffect } from 'react'
import { getWeatherForecast, ForecastDetail } from '../lib/weather'
import type { PlanetWeather, PlanetBuilding } from '../hooks/usePlanet'

type Props = {
  weather: PlanetWeather | null
  buildings: PlanetBuilding[]
}

function formatWeatherTime(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function WeatherDisplay({ weather, buildings }: Props) {
  const stationLevel = buildings.find((b) => b.building_id === 'weather_station')?.level ?? 0
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!weather?.expires_at) {
      setRemaining(null)
      return
    }
    const update = () => {
      const r = new Date(weather.expires_at!).getTime() - Date.now()
      setRemaining(r > 0 ? r : 0)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [weather?.expires_at])

  if (!weather) {
    return (
      <div className="text-xs text-slate-500">
        No weather data
      </div>
    )
  }

  const forecast = getWeatherForecast(stationLevel, {
    weatherType: weather.weather_type,
    metalMultiplier: Number(weather.metal_multiplier),
    gasMultiplier: Number(weather.gas_multiplier),
    energyMultiplier: Number(weather.energy_multiplier),
    startsAt: new Date(weather.started_at),
    expiresAt: weather.expires_at ? new Date(weather.expires_at) : null,
  })

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/30 rounded-lg">
      <span className="text-sm">
        {({
          calm_skies:      '☀️',
          solar_flare:     '🔆',
          metal_vein:      '⛏️',
          gas_pocket:      '💨',
          ion_storm:       '⚡',
          dust_storm:      '🌪️',
          solar_storm:     '☄️',
          asteroid_shower: '🪨',
          nebula_drift:    '🌌',
        } as Record<string, string>)[weather.weather_type] ?? '🌩️'}
      </span>
      <div>
        <div className="text-xs font-medium text-slate-200">
          {weather.weather_type === 'calm_skies' ? 'Calm Skies' : forecast.message}
          {remaining !== null && remaining > 0 && (
            <span className="text-slate-500 font-normal ml-1.5">· {formatWeatherTime(remaining)}</span>
          )}
        </div>
        {stationLevel === 0 && (
          <div className="text-[10px] text-slate-500">Build a Weather Station for forecasts</div>
        )}
        {stationLevel > 0 && forecast.detail === ForecastDetail.Vague && (
          <div className="text-[10px] text-slate-500">{forecast.message}</div>
        )}
        {forecast.multipliers && (
          <div className="text-[10px] text-slate-500">
            Metal ×{forecast.multipliers.metal} · Gas ×{forecast.multipliers.gas} · Energy ×{forecast.multipliers.energy}
          </div>
        )}
      </div>
    </div>
  )
}
