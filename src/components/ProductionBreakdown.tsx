type Props = {
  baseRate: number
  researchBonus: number
  researchLabel?: string
  weatherMultiplier: number
  weatherLabel?: string
  energyRatio: number
  effectiveRate: number
  unit?: string
}

export function ProductionBreakdown({
  baseRate,
  researchBonus,
  researchLabel,
  weatherMultiplier,
  weatherLabel,
  energyRatio,
  effectiveRate,
  unit = '/h',
}: Props) {
  const hasResearch = researchBonus > 0.001
  const hasWeather = Math.abs(weatherMultiplier - 1) > 0.001
  const hasEnergyPenalty = energyRatio < 0.999

  return (
    <div className="space-y-1">
      <Row label="Base production" value={`${Math.floor(baseRate).toLocaleString()}${unit}`} valueClass="text-slate-300" />
      {hasResearch && (
        <Row
          label={researchLabel ? `Research (${researchLabel})` : 'Research bonus'}
          value={`+${Math.round(researchBonus * 100)}%`}
          valueClass="text-emerald-400"
        />
      )}
      {hasWeather && (
        <Row
          label={weatherLabel ? `Weather (${weatherLabel})` : 'Weather'}
          value={`×${weatherMultiplier.toFixed(2)}`}
          valueClass={weatherMultiplier >= 1 ? 'text-emerald-400' : 'text-red-400'}
        />
      )}
      {hasEnergyPenalty && (
        <Row
          label="Energy penalty"
          value={`×${energyRatio.toFixed(2)}`}
          valueClass="text-yellow-400"
        />
      )}
      <div className="border-t border-slate-700/30 pt-1 mt-1">
        <Row label="Effective" value={`${Math.floor(effectiveRate).toLocaleString()}${unit}`} valueClass="text-slate-100 font-semibold" />
      </div>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}
