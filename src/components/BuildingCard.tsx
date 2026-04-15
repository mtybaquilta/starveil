import { Link } from 'react-router-dom'
import { getBuildingConfig } from '../config/buildings'
import { productionPerHour, storageCapacity } from '../config/formulas'

type Props = {
  buildingId: string
  level: number
  isUnlocked: boolean
  prerequisiteText?: string
}

const BASE_STORAGE = 10000

export function BuildingCard({ buildingId, level, isUnlocked, prerequisiteText }: Props) {
  const config = getBuildingConfig(buildingId)

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
      <div className="bg-slate-800/20 rounded-xl border border-dashed border-slate-700/30 overflow-hidden">
        <img src={config.image} alt={config.name} className="w-full h-32 object-cover opacity-30 grayscale" />
        <div className="px-4 py-3">
          <div className="text-xs font-semibold text-slate-600">{config.name}</div>
          <div className="text-[10px] text-slate-700">{prerequisiteText}</div>
        </div>
      </div>
    )
  }

  return (
    <Link
      to={`/buildings/${buildingId}`}
      className="block bg-slate-800/40 rounded-xl border border-slate-700/20 hover:border-slate-600/30 hover:bg-slate-800/60 transition-colors overflow-hidden"
    >
      <img src={config.image} alt={config.name} className="w-full h-32 object-cover" />
      <div className="px-4 py-3">
        <div className="text-sm font-semibold text-slate-200">{config.name}</div>
        <div className="text-[10px] text-slate-500">
          {level === 0 ? 'Not built' : `Level ${level} · ${statText}`}
        </div>
      </div>
    </Link>
  )
}
