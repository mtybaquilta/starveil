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
}: Props) {
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
        <span className="text-slate-400">{weatherType === 'calm_skies' ? '☀ Calm Skies' : weatherType}</span>
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
