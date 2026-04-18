import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PlanetVisual } from '../components/PlanetVisual'
import { BuildingCard } from '../components/BuildingCard'
import { EventTimeline } from '../components/EventTimeline'
import { WeatherDisplay } from '../components/WeatherDisplay'
import { BUILDINGS, getBuildingConfig } from '../config/buildings'
import { DEFENSES } from '../config/defenses'
import type { GameContext } from '../components/Layout'

function isBuildingUnlocked(
  buildingId: string,
  buildingLevels: Map<string, number>
): { unlocked: boolean; prerequisiteText?: string } {
  const config = getBuildingConfig(buildingId)
  for (const prereq of config.prerequisites) {
    const currentLevel = buildingLevels.get(prereq.buildingId) ?? 0
    if (currentLevel < prereq.level) {
      const prereqConfig = getBuildingConfig(prereq.buildingId)
      return {
        unlocked: false,
        prerequisiteText: `Requires ${prereqConfig.name} Lv.${prereq.level}`,
      }
    }
  }
  return { unlocked: true }
}

export function OverviewPage() {
  const { planet, buildings, weather, events, defenseFleet, refetch } = useOutletContext<GameContext>()
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(planet.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleRename = async () => {
    const trimmed = nameInput.trim()
    if (trimmed === planet.name) { setEditing(false); return }
    setSaving(true)
    setRenameError(null)
    const { data, error } = await supabase.functions.invoke('game-action', {
      body: { action: 'rename_planet', planetId: planet.id, newName: trimmed },
    })
    setSaving(false)
    if (error || data?.error) {
      setRenameError(data?.error ?? error?.message ?? 'Rename failed')
      return
    }
    setEditing(false)
    refetch()
  }

  const buildingLevels = new Map(buildings.map((b) => [b.building_id, b.level]))
  const usedSlots = buildings.filter((b) => b.level > 0).length

  return (
    <div>
      {/* Planet Header */}
      <div className="mb-5">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditing(false); setNameInput(planet.name) } }}
              maxLength={24}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-lg font-bold text-slate-100 outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleRename}
              disabled={saving}
              className="text-xs px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? '...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setNameInput(planet.name); setRenameError(null) }}
              className="text-xs px-2 py-1 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            {renameError && <span className="text-xs text-red-400">{renameError}</span>}
          </div>
        ) : (
          <h1
            className="text-lg font-bold text-slate-100 cursor-pointer hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 group"
            onClick={() => { setNameInput(planet.name); setEditing(true) }}
          >
            {planet.name}
            <svg className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </h1>
        )}
        <p className="text-xs text-slate-500 mt-0.5">
          Temperate · Diameter: {planet.diameter.toLocaleString()} km · Slots: {usedSlots}/{planet.max_building_slots} used
          {(() => {
            const defenseRating = defenseFleet.reduce((sum, d) => {
              const cfg = DEFENSES.find((def) => def.id === d.defense_type)
              return sum + (cfg ? (cfg.attack + cfg.defense) * d.count : 0)
            }, 0)
            return defenseRating > 0 ? <span className="ml-2 text-emerald-400">· Defense: {defenseRating}</span> : null
          })()}
        </p>
      </div>

      {/* Weather */}
      <div className="mb-5">
        <WeatherDisplay weather={weather} buildings={buildings} />
      </div>

      {/* Planet Visual */}
      <div className="mb-6">
        <PlanetVisual />
      </div>

      {/* Event Timeline */}
      <div className="mb-6">
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Recent Events</h2>
        <EventTimeline events={events} />
      </div>

      {/* Building Grid */}
      <div>
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Buildings</h2>
        <div className="grid grid-cols-3 gap-3">
          {BUILDINGS.map((config) => {
            const level = buildingLevels.get(config.id) ?? 0
            const { unlocked, prerequisiteText } = isBuildingUnlocked(config.id, buildingLevels)
            return (
              <BuildingCard
                key={config.id}
                buildingId={config.id}
                level={level}
                isUnlocked={unlocked}
                prerequisiteText={prerequisiteText}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
