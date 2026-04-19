import { useState } from 'react'
import { getBuildingConfig, BUILDINGS } from '../config/buildings'
import { productionPerHour, upgradeCost, buildTimeSeconds, energyConsumption, storageCapacity } from '../config/formulas'
import { formatTime } from '../hooks/useConstructionQueue'
import { LevelProgression } from './LevelProgression'
import { ProductionBreakdown } from './ProductionBreakdown'
import type { PlanetBuilding, ConstructionItem, PlanetWeather } from '../hooks/usePlanet'

const WEATHER_NAMES: Record<string, string> = {
  calm_skies: 'Calm Skies', solar_flare: 'Solar Flare', metal_vein: 'Metal Vein',
  gas_pocket: 'Gas Pocket', ion_storm: 'Ion Storm', dust_storm: 'Dust Storm',
  solar_storm: 'Solar Storm', asteroid_shower: 'Asteroid Shower', nebula_drift: 'Nebula Drift',
}

type ResourceSnapshot = {
  metalResearchBonus: number
  gasResearchBonus: number
  energyResearchBonus: number
  energyRatio: number
  metalPerHour: number
  gasPerHour: number
  energyProduced: number
}

type Props = {
  buildingId: string
  buildings: PlanetBuilding[]
  metal: number
  gas: number
  activeBuild: ConstructionItem | null
  onStartBuild: (buildingId: string) => Promise<void>
  resources: ResourceSnapshot
  weather: PlanetWeather | null
}

const BASE_STORAGE = 10000

export function BuildingDetail({ buildingId, buildings, metal, gas, activeBuild, onStartBuild, resources, weather }: Props) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const config = getBuildingConfig(buildingId)
  const level = buildings.find((b) => b.building_id === buildingId)?.level ?? 0
  const targetLevel = level + 1
  const isMaxLevel = level >= config.maxLevel

  const metalCost = isMaxLevel ? 0 : Math.floor(upgradeCost(config.baseCost.metal, targetLevel))
  const gasCost = isMaxLevel ? 0 : Math.floor(upgradeCost(config.baseCost.gas, targetLevel))
  const canAfford = metal >= metalCost && gas >= gasCost
  const queueFull = activeBuild !== null
  const canUpgrade = canAfford && !queueFull && !isMaxLevel

  const currentProduction = productionPerHour(config.baseProductionPerHour, level)
  const nextProduction = productionPerHour(config.baseProductionPerHour, targetLevel)
  const currentEnergy = energyConsumption(config.baseEnergyConsumption, level)
  const nextEnergy = energyConsumption(config.baseEnergyConsumption, targetLevel)
  const buildTime = isMaxLevel ? 0 : buildTimeSeconds(config.baseBuildTimeSeconds, targetLevel)

  const unlocks = BUILDINGS.filter((b) =>
    b.prerequisites.some((p) => p.buildingId === buildingId)
  ).map((b) => ({
    name: b.name,
    requiredLevel: b.prerequisites.find((p) => p.buildingId === buildingId)!.level,
    met: level >= b.prerequisites.find((p) => p.buildingId === buildingId)!.level,
  }))

  async function handleUpgrade() {
    setError('')
    setLoading(true)
    try {
      await onStartBuild(buildingId)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-[10px] text-slate-500 mb-4">
        Buildings <span className="text-slate-600">/</span> {config.name}
      </div>

      {/* Header */}
      <div className="flex gap-5 mb-6">
        <img src={config.image} alt={config.name} className="w-28 h-28 rounded-xl object-cover shrink-0" />
        <div className="flex-1">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-xl font-bold text-slate-100">{config.name}</h1>
            <span className="text-sm font-semibold text-orange-400">Level {level}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mt-2">{config.description}</p>
          <div className="flex gap-4 mt-3">
            {config.baseProductionPerHour > 0 && level > 0 && (
              <div className="flex-1">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                  {buildingId === 'solar_array' ? 'Energy Output' : 'Current Output'}
                </div>
                <ProductionBreakdown
                  baseRate={currentProduction}
                  researchBonus={
                    buildingId === 'metal_mine' ? resources.metalResearchBonus
                    : buildingId === 'gas_refinery' ? resources.gasResearchBonus
                    : buildingId === 'solar_array' ? resources.energyResearchBonus
                    : 0
                  }
                  weatherMultiplier={
                    buildingId === 'metal_mine' ? (weather ? Number(weather.metal_multiplier) : 1)
                    : buildingId === 'gas_refinery' ? (weather ? Number(weather.gas_multiplier) : 1)
                    : 1
                  }
                  weatherLabel={weather ? (WEATHER_NAMES[weather.weather_type] ?? weather.weather_type) : 'Calm Skies'}
                  energyRatio={buildingId === 'solar_array' ? 1 : resources.energyRatio}
                  effectiveRate={
                    buildingId === 'metal_mine' ? resources.metalPerHour
                    : buildingId === 'gas_refinery' ? resources.gasPerHour
                    : resources.energyProduced
                  }
                  unit={buildingId === 'solar_array' ? '' : '/h'}
                />
                {!isMaxLevel && (
                  <div className="mt-2 text-[10px] text-green-400">
                    Next level: {Math.floor(nextProduction)}{buildingId === 'solar_array' ? '' : '/h'}
                  </div>
                )}
              </div>
            )}
            {config.baseProductionPerHour > 0 && level === 0 && (
              <>
                <StatBlock label="At Level 1" value={`${Math.floor(nextProduction)}`} suffix={buildingId === 'solar_array' ? '' : '/hr'} color="text-orange-400" />
              </>
            )}
            {config.category === 'storage' && level > 0 && (
              <StatBlock label="Capacity" value={Math.floor(storageCapacity(BASE_STORAGE, level)).toLocaleString()} color="text-slate-300" />
            )}
            {config.baseEnergyConsumption > 0 && (
              <StatBlock
                label="Energy Use"
                value={`${Math.floor(currentEnergy)}`}
                suffix={isMaxLevel ? '' : ` → ${Math.floor(nextEnergy)}`}
                color="text-green-400"
              />
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Section */}
      {!isMaxLevel && (
        <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/10 mb-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Upgrade to Level {targetLevel}</h2>

          <div className="flex gap-4 mb-4">
            <CostItem color="bg-orange-400" label="Metal" cost={metalCost} have={metal} />
            {gasCost > 0 && <CostItem color="bg-violet-400" label="Gas" cost={gasCost} have={gas} />}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500">Build time</div>
              <div className="text-sm text-slate-200 font-medium">{formatTime(buildTime * 1000)}</div>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={!canUpgrade || loading}
              className="px-7 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/20"
            >
              {loading ? 'Building...' : queueFull ? 'Queue Full' : 'Upgrade →'}
            </button>
          </div>

          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      )}

      {isMaxLevel && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4 text-center">
          <span className="text-yellow-400 text-sm font-semibold">Maximum Level Reached</span>
        </div>
      )}

      {/* Unlocks */}
      {unlocks.length > 0 && (
        <div className="bg-slate-800/20 rounded-lg p-4 border border-slate-700/10 mb-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-2">Unlocks</h3>
          <div className="flex gap-2 flex-wrap">
            {unlocks.map((u) => (
              <div
                key={u.name}
                className={`px-2.5 py-1.5 rounded text-[10px] ${
                  u.met
                    ? 'bg-indigo-500/10 text-indigo-300'
                    : 'bg-slate-800/50 text-slate-500'
                }`}
              >
                {u.name} <span className="text-slate-600">@ Lv.{u.requiredLevel}</span>
                {u.met && ' ✓'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Level Progression */}
      <LevelProgression config={config} currentLevel={level} />
    </div>
  )
}

function StatBlock({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color: string }) {
  return (
    <div>
      <div className="text-[9px] text-slate-500 uppercase tracking-widest">{label}</div>
      <div className={`text-base font-bold ${color} mt-0.5`}>
        {value}
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  )
}

function CostItem({ color, label, cost, have }: { color: string; label: string; cost: number; have: number }) {
  const canAfford = have >= cost
  return (
    <div className="flex-1 p-3 bg-slate-900/50 rounded-lg flex items-center gap-2.5">
      <div className={`w-2 h-2 rounded-sm ${color}`} />
      <div>
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-100">{cost.toLocaleString()}</div>
      </div>
      <div className={`ml-auto text-[10px] ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
        {canAfford ? '✓' : '✗'} {Math.floor(have).toLocaleString()}
      </div>
    </div>
  )
}
