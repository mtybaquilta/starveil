import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GameContext } from '../components/Layout'
import type { GalaxyMapEntry } from '../hooks/usePlanet'

const LOCATION_ICONS: Record<string, string> = {
  asteroid_field: '☄️',
  bandit_camp: '💀',
  debris_field: '🪨',
  empty: '·',
}

function locationIcon(entry: GalaxyMapEntry): string {
  if (entry.visibility === 'detected') return '?'
  if (!entry.location_type) return '·'
  return LOCATION_ICONS[entry.location_type] ?? '·'
}

function visibilityClass(entry: GalaxyMapEntry): string {
  if (entry.visibility === 'detected') return 'text-yellow-500/60'
  if (entry.cleared_at && (!entry.respawns_at || new Date(entry.respawns_at) > new Date())) {
    return 'text-slate-600'
  }
  const colors: Record<string, string> = {
    asteroid_field: 'text-amber-400',
    bandit_camp: 'text-red-400',
    debris_field: 'text-slate-400',
    empty: 'text-slate-600',
  }
  return colors[entry.location_type ?? 'empty'] ?? 'text-slate-400'
}

export function GalaxyMapPage() {
  const { planet, galaxyMap, buildings, refetch } = useOutletContext<GameContext>()
  const [selected, setSelected] = useState<GalaxyMapEntry | null>(null)
  const [sending, setSending] = useState(false)

  const radarLevel = buildings.find((b) => b.building_id === 'radar_array')?.level ?? 0

  const handleSendProbe = async (coords: string) => {
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'send_probe', planetId: planet.id, targetCoords: coords },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      await refetch()
      setSelected(null)
    } catch (err) {
      console.error('Failed to send probe:', err)
    } finally {
      setSending(false)
    }
  }

  const handleRunRadar = async () => {
    if (radarLevel < 1) return
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'run_radar', planetId: planet.id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      await refetch()
    } catch (err) {
      console.error('Failed to run radar:', err)
    } finally {
      setSending(false)
    }
  }

  const detectedCount = galaxyMap.filter((e) => e.visibility === 'detected').length
  const revealedCount = galaxyMap.filter((e) => e.visibility === 'revealed').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Galaxy Map</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {detectedCount} detected · {revealedCount} revealed
          </p>
        </div>
        <button
          onClick={handleRunRadar}
          disabled={radarLevel < 1 || sending}
          className="px-3 py-1.5 text-xs font-medium rounded bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {radarLevel < 1 ? 'Build Radar Array to scan' : 'Run Radar Scan'}
        </button>
      </div>

      <div className="flex gap-4">
        {/* Map grid */}
        <div className="flex-1 bg-slate-900/50 border border-slate-800/40 rounded-lg p-4 min-h-64">
          {galaxyMap.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              {radarLevel < 1
                ? 'Build a Radar Array to start detecting coordinates.'
                : 'No coordinates detected yet. Run a radar scan.'}
            </div>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
              {galaxyMap.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className={`
                    text-center p-2 rounded border transition-colors text-xs
                    ${selected?.id === entry.id
                      ? 'border-indigo-500/60 bg-indigo-500/10'
                      : 'border-slate-800/40 bg-slate-900/30 hover:border-slate-700/60'}
                  `}
                >
                  <div className={`text-lg ${visibilityClass(entry)}`}>
                    {locationIcon(entry)}
                  </div>
                  <div className="text-[9px] text-slate-600 mt-0.5 font-mono">
                    {entry.coordinates}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-56 bg-slate-900/50 border border-slate-800/40 rounded-lg p-4 space-y-3">
            <div>
              <div className="font-mono text-xs text-slate-400">{selected.coordinates}</div>
              <div className="text-sm font-medium text-slate-200 mt-1">
                {selected.name ?? (selected.visibility === 'detected' ? 'Unknown Signal' : 'Empty Space')}
              </div>
            </div>

            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className={`font-medium ${selected.visibility === 'detected' ? 'text-yellow-400' : 'text-green-400'}`}>
                  {selected.visibility === 'detected' ? 'Detected' : 'Revealed'}
                </span>
              </div>
              {selected.location_type && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-300 capitalize">{selected.location_type.replace('_', ' ')}</span>
                </div>
              )}
              {selected.cleared_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cleared</span>
                  <span className="text-slate-400 text-[10px]">
                    {selected.respawns_at
                      ? `Respawns ${new Date(selected.respawns_at).toLocaleTimeString()}`
                      : 'Cleared'}
                  </span>
                </div>
              )}
            </div>

            {selected.visibility === 'detected' && (
              <button
                onClick={() => handleSendProbe(selected.coordinates)}
                disabled={sending}
                className="w-full px-3 py-1.5 text-xs font-medium rounded bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/30 disabled:opacity-40 transition-colors"
              >
                {sending ? 'Sending…' : 'Send Probe'}
              </button>
            )}

            <button
              onClick={() => setSelected(null)}
              className="w-full px-3 py-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              Deselect
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
