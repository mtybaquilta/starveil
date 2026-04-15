import { useOutletContext } from 'react-router-dom'
import { getBuildingConfig } from '../config/buildings'
import { energyConsumption } from '../config/formulas'
import { ProductionBreakdown } from '../components/ProductionBreakdown'
import type { GameContext } from '../components/Layout'

const WEATHER_NAMES: Record<string, string> = {
  calm_skies: 'Calm Skies', solar_flare: 'Solar Flare', metal_vein: 'Metal Vein',
  gas_pocket: 'Gas Pocket', ion_storm: 'Ion Storm', dust_storm: 'Dust Storm',
  solar_storm: 'Solar Storm', asteroid_shower: 'Asteroid Shower', nebula_drift: 'Nebula Drift',
}

export function ResourcesPage() {
  const { buildings, resources, weather } = useOutletContext<GameContext>()

  const buildingLevels = new Map(buildings.map((b) => [b.building_id, b.level]))

  const metalMineLevel = buildingLevels.get('metal_mine') ?? 0
  const gasRefineryLevel = buildingLevels.get('gas_refinery') ?? 0
  const solarLevel = buildingLevels.get('solar_array') ?? 0

  const weatherName = weather ? (WEATHER_NAMES[weather.weather_type] ?? weather.weather_type) : 'Calm Skies'

  const energyUsers: { name: string; amount: number }[] = []
  for (const [id, level] of buildingLevels) {
    if (level <= 0) continue
    const config = getBuildingConfig(id)
    const consumption = energyConsumption(config.baseEnergyConsumption, level)
    if (consumption > 0) {
      energyUsers.push({ name: config.name, amount: consumption })
    }
  }
  energyUsers.sort((a, b) => b.amount - a.amount)

  const metalStorageLevel = buildingLevels.get('metal_storage') ?? 0
  const gasStorageLevel = buildingLevels.get('gas_storage') ?? 0

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-100 mb-1">Resources</h1>
      <p className="text-xs text-slate-500 mb-6">Production breakdown and storage capacity</p>

      {/* Production Section */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <ResourcePanel
          label="Metal"
          color="text-orange-400"
          bgColor="bg-orange-400"
          baseRate={resources.metalBaseFromBuildings}
          researchBonus={resources.metalResearchBonus}
          weatherMultiplier={weather ? Number(weather.metal_multiplier) : 1}
          weatherLabel={weatherName}
          energyRatio={resources.energyRatio}
          effectiveProduction={resources.metalPerHour}
          current={resources.metal}
          cap={resources.metalStorageCap}
          source={`Metal Mine Lv.${metalMineLevel}`}
        />
        <ResourcePanel
          label="Gas"
          color="text-violet-400"
          bgColor="bg-violet-400"
          baseRate={resources.gasBaseFromBuildings}
          researchBonus={resources.gasResearchBonus}
          weatherMultiplier={weather ? Number(weather.gas_multiplier) : 1}
          weatherLabel={weatherName}
          energyRatio={resources.energyRatio}
          effectiveProduction={resources.gasPerHour}
          current={resources.gas}
          cap={resources.gasStorageCap}
          source={`Gas Refinery Lv.${gasRefineryLevel}`}
        />
      </div>

      {/* Energy Balance */}
      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/10 mb-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Energy Balance</h2>
        <div className="flex items-baseline gap-4 mb-4">
          <div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Produced</div>
            <div className="text-xl font-bold text-green-400">{Math.floor(resources.energyProduced)}</div>
            <div className="text-[10px] text-slate-500">Solar Array Lv.{solarLevel}</div>
          </div>
          <div className="text-slate-600 text-lg">/</div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Consumed</div>
            <div className="text-xl font-bold text-red-400">{Math.floor(resources.energyConsumed)}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Efficiency</div>
            <div className={`text-xl font-bold ${resources.energyRatio >= 1 ? 'text-green-400' : 'text-yellow-400'}`}>
              {Math.floor(resources.energyRatio * 100)}%
            </div>
            {resources.energyRatio < 1 && (
              <div className="text-[10px] text-yellow-400/70">Production penalized!</div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          {energyUsers.map((user) => (
            <div key={user.name} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{user.name}</span>
              <span className="text-slate-500">{Math.floor(user.amount)} energy</span>
            </div>
          ))}
        </div>
      </div>

      {/* Storage */}
      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/10">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Storage Capacity</h2>
        <div className="space-y-3">
          <StorageBar
            label="Metal"
            current={resources.metal}
            cap={resources.metalStorageCap}
            color="bg-orange-400"
            level={metalStorageLevel}
          />
          <StorageBar
            label="Gas"
            current={resources.gas}
            cap={resources.gasStorageCap}
            color="bg-violet-400"
            level={gasStorageLevel}
          />
        </div>
      </div>
    </div>
  )
}

function ResourcePanel({
  label, color, bgColor, baseRate, researchBonus, weatherMultiplier, weatherLabel,
  energyRatio, effectiveProduction, current, cap, source,
}: {
  label: string; color: string; bgColor: string; baseRate: number
  researchBonus: number; weatherMultiplier: number; weatherLabel: string
  energyRatio: number; effectiveProduction: number; current: number; cap: number; source: string
}) {
  return (
    <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/10">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-sm ${bgColor}`} />
        <span className={`text-sm font-semibold ${color}`}>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {Math.floor(current).toLocaleString()}
      </div>
      <div className="text-[10px] text-slate-500 mt-1">
        of {Math.floor(cap).toLocaleString()} capacity
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700/10">
        <ProductionBreakdown
          baseRate={baseRate}
          researchBonus={researchBonus}
          weatherMultiplier={weatherMultiplier}
          weatherLabel={weatherLabel}
          energyRatio={energyRatio}
          effectiveRate={effectiveProduction}
        />
        <div className="text-[10px] text-slate-600 mt-2">{source}</div>
      </div>
    </div>
  )
}

function StorageBar({ label, current, cap, color, level }: {
  label: string; current: number; cap: number; color: string; level: number
}) {
  const pct = cap > 0 ? Math.min(100, (current / cap) * 100) : 0
  const isFull = pct >= 99
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label} Storage {level > 0 ? `Lv.${level}` : '(base)'}</span>
        <span className={isFull ? 'text-red-400' : 'text-slate-500'}>
          {Math.floor(current).toLocaleString()} / {Math.floor(cap).toLocaleString()}
          {isFull && ' FULL'}
        </span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isFull ? 'bg-red-400' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
