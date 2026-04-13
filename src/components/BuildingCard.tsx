import { Link } from 'react-router-dom'
import { getBuildingConfig } from '../config/buildings'
import { productionPerHour, storageCapacity } from '../config/formulas'

type Props = {
  buildingId: string
  level: number
  isUnlocked: boolean
  prerequisiteText?: string
}

const BUILDING_ICONS: Record<string, string> = {
  headquarters: '🏛️',
  metal_mine: '⛏️',
  gas_refinery: '🔮',
  solar_array: '⚡',
  metal_storage: '🏭',
  gas_storage: '🛢️',
  weather_station: '🌤️',
  research_lab: '🔬',
  perimeter_turret: '🔫',
  ion_cannon: '⚡',
  missile_battery: '🚀',
  shield_generator: '🛡️',
  sensor_jammer: '📡',
  orbital_platform: '🛸',
}

const BASE_STORAGE = 10000

export function BuildingCard({ buildingId, level, isUnlocked, prerequisiteText }: Props) {
  const config = getBuildingConfig(buildingId)
  const icon = BUILDING_ICONS[buildingId] ?? '🏗️'

  let statText = ''
  if (config.category === 'resource' && level > 0) {
    const prod = productionPerHour(config.baseProductionPerHour, level)
    if (buildingId === 'solar_array') {
      statText = `${Math.floor(prod)} energy`
    } else {
      statText = `+${Math.floor(prod)}/h`
    }
  } else if (config.category === 'storage' && level > 0) {
    statText = `${Math.floor(storageCapacity(BASE_STORAGE, level)).toLocaleString()} cap`
  } else if (config.category === 'defense' && level > 0 && config.defenseRating) {
    statText = `${config.defenseRating * level} defense`
  } else if (buildingId === 'headquarters' && level > 0) {
    statText = `${level + 8} slots`
  } else if (level > 0) {
    statText = `Lv. ${level}`
  }

  if (!isUnlocked) {
    return (
      <div className="p-3.5 bg-slate-800/20 rounded-lg border border-dashed border-slate-700/30">
        <div className="w-10 h-10 rounded-md bg-slate-800/50 flex items-center justify-center text-lg opacity-40 mb-2">
          {icon}
        </div>
        <div className="text-xs font-semibold text-slate-600">{config.name}</div>
        <div className="text-[10px] text-slate-700">{prerequisiteText}</div>
      </div>
    )
  }

  return (
    <Link
      to={`/buildings/${buildingId}`}
      className="block p-3.5 bg-slate-800/40 rounded-lg border border-slate-700/10 hover:border-slate-600/30 hover:bg-slate-800/60 transition-colors"
    >
      <div className="w-10 h-10 rounded-md bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-lg mb-2">
        {icon}
      </div>
      <div className="text-xs font-semibold text-slate-200">{config.name}</div>
      <div className="text-[10px] text-slate-500">
        {level === 0 ? 'Not built' : `Level ${level} · ${statText}`}
      </div>
    </Link>
  )
}
