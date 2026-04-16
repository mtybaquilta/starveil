import { useState, useEffect } from 'react'
import { ProductionBreakdown } from './ProductionBreakdown'

type Props = {
  metal: number
  gas: number
  metalPerHour: number
  gasPerHour: number
  metalBaseRate: number
  gasBaseRate: number
  metalResearchBonus: number
  gasResearchBonus: number
  energyProduced: number
  energyConsumed: number
  energyRatio: number
  planetName: string
  coordinates: string
  weatherType: string
  weatherExpiresAt: string | null
  weatherMetalMultiplier: number
  weatherGasMultiplier: number
  weatherStationLevel: number
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

const WEATHER_NAMES: Record<string, string> = {
  calm_skies: 'Calm Skies', solar_flare: 'Solar Flare', metal_vein: 'Metal Vein',
  gas_pocket: 'Gas Pocket', ion_storm: 'Ion Storm', dust_storm: 'Dust Storm',
  solar_storm: 'Solar Storm', asteroid_shower: 'Asteroid Shower', nebula_drift: 'Nebula Drift',
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

function weatherImpactSummary(
  metalMult: number,
  gasMult: number,
  stationLevel: number
): { text: string; isNegative: boolean } | null {
  if (stationLevel === 0) return null
  const parts: { text: string; negative: boolean }[] = []
  if (Math.abs(metalMult - 1) > 0.001) {
    const pct = Math.round(Math.abs(metalMult - 1) * 100)
    parts.push({ text: `Metal ${metalMult > 1 ? '+' : '−'}${pct}%`, negative: metalMult < 1 })
  }
  if (Math.abs(gasMult - 1) > 0.001) {
    const pct = Math.round(Math.abs(gasMult - 1) * 100)
    parts.push({ text: `Gas ${gasMult > 1 ? '+' : '−'}${pct}%`, negative: gasMult < 1 })
  }
  if (parts.length === 0) return null
  return {
    text: parts.map((p) => p.text).join(' · '),
    isNegative: parts.some((p) => p.negative),
  }
}

export function ResourceBar({
  metal, gas, metalPerHour, gasPerHour,
  metalBaseRate, gasBaseRate, metalResearchBonus, gasResearchBonus,
  energyProduced, energyConsumed, energyRatio,
  planetName, coordinates, weatherType, weatherExpiresAt,
  weatherMetalMultiplier, weatherGasMultiplier, weatherStationLevel,
}: Props) {
  const [weatherRemaining, setWeatherRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!weatherExpiresAt) { setWeatherRemaining(null); return }
    const update = () => {
      const remaining = new Date(weatherExpiresAt).getTime() - Date.now()
      setWeatherRemaining(remaining > 0 ? remaining : 0)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [weatherExpiresAt])

  const weatherName = WEATHER_NAMES[weatherType] ?? weatherType
  const impact = weatherImpactSummary(weatherMetalMultiplier, weatherGasMultiplier, weatherStationLevel)

  return (
    <div className="flex items-center px-5 py-2.5 flex-1">
      <div className="text-sm font-bold text-slate-100 mr-6 tracking-wide">STARVEIL: Interstellar Siege</div>

      <div className="flex gap-5 flex-1">
        <ResourceItem
          color="bg-orange-400"
          value={metal}
          rate={metalPerHour}
          textColor="text-orange-400"
          label="Metal"
          baseRate={metalBaseRate}
          researchBonus={metalResearchBonus}
          weatherMultiplier={weatherMetalMultiplier}
          weatherLabel={weatherName}
          energyRatio={energyRatio}
        />
        <ResourceItem
          color="bg-violet-400"
          value={gas}
          rate={gasPerHour}
          textColor="text-violet-400"
          label="Gas"
          baseRate={gasBaseRate}
          researchBonus={gasResearchBonus}
          weatherMultiplier={weatherGasMultiplier}
          weatherLabel={weatherName}
          energyRatio={energyRatio}
        />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-green-400" />
          <span className="text-green-400 font-semibold text-sm">
            {Math.floor(energyProduced)}/{Math.floor(energyConsumed)}
          </span>
          <span className="text-slate-500 text-[10px]">energy</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-slate-500 text-xs">
        <span>
          <span className="text-slate-400">{WEATHER_LABELS[weatherType] ?? weatherType}</span>
          {impact && (
            <span className={`ml-1.5 ${impact.isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
              · {impact.text}
            </span>
          )}
          {weatherRemaining !== null && weatherRemaining > 0 && (
            <span className="text-slate-600 ml-1.5">{formatWeatherTime(weatherRemaining)}</span>
          )}
        </span>
        <span className="text-slate-500">{planetName} · {coordinates}</span>
      </div>
    </div>
  )
}

function ResourceItem({
  color, value, rate, textColor, label,
  baseRate, researchBonus, weatherMultiplier, weatherLabel, energyRatio,
}: {
  color: string; value: number; rate: number; textColor: string; label: string
  baseRate: number; researchBonus: number; weatherMultiplier: number; weatherLabel: string; energyRatio: number
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-sm ${color}`} />
      <span className={`font-semibold text-sm ${textColor}`}>
        {Math.floor(value).toLocaleString()}
      </span>
      <button
        className="text-slate-500 text-[10px] hover:text-slate-300 transition-colors cursor-pointer"
        onClick={() => setShowTooltip((s) => !s)}
        onBlur={() => setTimeout(() => setShowTooltip(false), 150)}
      >
        +{Math.floor(rate).toLocaleString()}/h
      </button>
      <span className="sr-only">{label}</span>

      {showTooltip && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-slate-900 border border-slate-700/40 rounded-lg p-3 shadow-xl min-w-[200px]">
          <div className={`text-[10px] font-semibold ${textColor} mb-2`}>{label} Production</div>
          <ProductionBreakdown
            baseRate={baseRate}
            researchBonus={researchBonus}
            weatherMultiplier={weatherMultiplier}
            weatherLabel={weatherLabel}
            energyRatio={energyRatio}
            effectiveRate={rate}
          />
        </div>
      )}
    </div>
  )
}
