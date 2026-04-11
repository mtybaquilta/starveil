import { useState } from 'react'
import { upgradeCost, productionPerHour, buildTimeSeconds, energyConsumption, storageCapacity } from '../config/formulas'
import { formatTime } from '../hooks/useConstructionQueue'
import type { BuildingConfig } from '../config/buildings'

type Props = {
  config: BuildingConfig
  currentLevel: number
}

const BASE_STORAGE = 10000

export function LevelProgression({ config, currentLevel }: Props) {
  const [expanded, setExpanded] = useState(false)

  const levels = Array.from({ length: config.maxLevel }, (_, i) => i + 1)

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-200">Level Progression</span>
          <span className="text-[10px] text-slate-500">— View all {config.maxLevel} levels</span>
        </div>
        <span className="text-slate-500 text-xs">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t border-slate-700/20">
                <th className="px-3 py-2 text-left text-slate-500 font-medium text-[10px]">Level</th>
                <th className="px-3 py-2 text-right text-orange-400/70 font-medium text-[10px]">Metal Cost</th>
                <th className="px-3 py-2 text-right text-violet-400/70 font-medium text-[10px]">Gas Cost</th>
                {config.baseProductionPerHour > 0 && (
                  <th className="px-3 py-2 text-right text-orange-400/70 font-medium text-[10px]">Output/hr</th>
                )}
                {config.category === 'storage' && (
                  <th className="px-3 py-2 text-right text-slate-400 font-medium text-[10px]">Capacity</th>
                )}
                <th className="px-3 py-2 text-right text-green-400/70 font-medium text-[10px]">Energy</th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium text-[10px]">Build Time</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const isCurrent = level === currentLevel
                const isNext = level === currentLevel + 1
                const isMax = level === config.maxLevel
                const isPast = level < currentLevel

                let rowClass = ''
                if (isCurrent) rowClass = 'bg-indigo-500/10'
                else if (isNext) rowClass = 'bg-green-500/5'

                let levelClass = 'text-slate-400'
                let levelSuffix = ''
                if (isCurrent) { levelClass = 'text-indigo-400 font-semibold'; levelSuffix = ' ◂' }
                else if (isNext) { levelClass = 'text-green-400 font-semibold'; levelSuffix = ' ★' }
                else if (isMax) { levelClass = 'text-yellow-400 font-semibold' }

                return (
                  <tr
                    key={level}
                    className={`border-t border-slate-700/10 ${rowClass} ${isPast ? 'opacity-50' : ''}`}
                  >
                    <td className={`px-3 py-1.5 ${levelClass}`}>{level}{levelSuffix}</td>
                    <td className="px-3 py-1.5 text-right text-slate-200">
                      {Math.floor(upgradeCost(config.baseCost.metal, level)).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-200">
                      {Math.floor(upgradeCost(config.baseCost.gas, level)).toLocaleString()}
                    </td>
                    {config.baseProductionPerHour > 0 && (
                      <td className="px-3 py-1.5 text-right text-orange-400">
                        {Math.floor(productionPerHour(config.baseProductionPerHour, level)).toLocaleString()}
                      </td>
                    )}
                    {config.category === 'storage' && (
                      <td className="px-3 py-1.5 text-right text-slate-300">
                        {Math.floor(storageCapacity(BASE_STORAGE, level)).toLocaleString()}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-right text-green-400">
                      {Math.floor(energyConsumption(config.baseEnergyConsumption, level))}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${isMax ? 'text-yellow-400' : 'text-slate-400'}`}>
                      {formatTime(buildTimeSeconds(config.baseBuildTimeSeconds, level) * 1000)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
