import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GameContext } from '../components/Layout'
import type { GalaxyMapEntry } from '../hooks/usePlanet'

const CANVAS_W = 2400
const CANVAS_H = 1600
const HOME_X = CANVAS_W / 2
const HOME_Y = CANVAS_H / 2
const SYSTEM_COL_W = 200   // px per system number (horizontal)
const POSITION_ROW_H = 80  // px per position number (vertical)
const CONNECTION_RADIUS = 400

function parseCoords(coords: string): { galaxy: number; system: number; position: number } {
  const [g, s, p] = coords.split(':').map(Number)
  return { galaxy: g, system: s, position: p }
}

function coordsToPosition(
  coords: string,
  homeCoords: string,
): { x: number; y: number } {
  const loc = parseCoords(coords)
  const home = parseCoords(homeCoords)

  const x = HOME_X + (loc.system - home.system) * SYSTEM_COL_W
  const y = HOME_Y + (loc.position - home.position) * POSITION_ROW_H

  return {
    x: Math.max(40, Math.min(CANVAS_W - 80, x)),
    y: Math.max(40, Math.min(CANVAS_H - 120, y)),
  }
}

function AsteroidTile() {
  return (
    <>
      <div className="w-[20px] h-[13px] rounded-[40%] -rotate-[10deg]" style={{ background: 'radial-gradient(ellipse, #78716c, #44403c 70%)' }} />
      <div className="absolute w-[10px] h-[7px] rounded-[40%] top-[8px] right-[7px] rotate-[15deg]" style={{ background: 'radial-gradient(ellipse, #a8a29e, #57534e 70%)' }} />
      <div className="absolute w-[6px] h-[4px] rounded-full bg-stone-500 bottom-[9px] left-[8px]" />
    </>
  )
}

function BanditTile() {
  return (
    <>
      <div className="w-[20px] h-[20px] rounded-[3px] rotate-45 border border-red-500/25" style={{ background: 'linear-gradient(135deg, #374151, #1f2937)' }} />
      <div className="absolute w-1 h-1 rounded-full bg-red-500 top-[12px] left-1/2 -translate-x-1/2" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />
    </>
  )
}

function DebrisTile() {
  return (
    <>
      <div className="absolute w-[16px] h-[8px] rounded-sm rotate-[20deg] top-[12px] left-[7px]" style={{ background: 'linear-gradient(135deg, #64748b, #475569)' }} />
      <div className="absolute w-[9px] h-[5px] rounded-sm -rotate-[12deg] bottom-[10px] right-[8px]" style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)' }} />
      <div className="absolute w-[5px] h-[4px] rounded-sm bg-slate-600 rotate-[35deg] top-[19px] right-[12px]" />
    </>
  )
}

function LocationNode({
  entry,
  homeCoords,
  isSelected,
  onSelect,
}: {
  entry: GalaxyMapEntry
  homeCoords: string
  isSelected: boolean
  onSelect: () => void
}) {
  const pos = coordsToPosition(entry.coordinates, homeCoords)
  const isDetected = entry.visibility === 'detected'
  const type = entry.location_type

  const tileClasses = isDetected
    ? 'w-[36px] h-[36px] rounded-full border-[1.5px] border-dashed border-yellow-500/35 bg-yellow-500/[0.04]'
    : type === 'asteroid_field'
      ? 'w-[50px] h-[50px] rounded-lg border-[1.5px] border-amber-500/15 bg-gradient-to-br from-stone-500/25 to-stone-700/35'
      : type === 'bandit_camp'
        ? 'w-[50px] h-[50px] rounded-lg border-[1.5px] border-red-500/20 bg-gradient-to-br from-red-900/25 to-red-950/30'
        : type === 'debris_field'
          ? 'w-[50px] h-[50px] rounded-lg border-[1.5px] border-slate-400/12 bg-gradient-to-br from-slate-600/30 to-slate-800/45'
          : 'w-[50px] h-[50px] rounded-lg border-[1.5px] border-slate-700/20 bg-slate-800/30'

  const labelColor = isDetected
    ? 'text-yellow-500/45'
    : type === 'asteroid_field' ? 'text-amber-400'
    : type === 'bandit_camp' ? 'text-red-400'
    : type === 'debris_field' ? 'text-slate-400'
    : 'text-slate-500'

  return (
    <div
      data-clickable
      onClick={onSelect}
      className={`absolute flex flex-col items-center gap-1 cursor-pointer z-[5] transition-transform hover:scale-110 ${isSelected ? 'z-10' : ''}`}
      style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className={`relative flex items-center justify-center overflow-hidden transition-all ${tileClasses} ${
          isSelected ? '!border-indigo-500/70 shadow-[0_0_24px_rgba(99,102,241,0.3)]' : ''
        }`}
      >
        {isDetected && (
          <span className="text-[15px] text-yellow-500/50 font-bold animate-pulse">?</span>
        )}
        {!isDetected && type === 'asteroid_field' && <AsteroidTile />}
        {!isDetected && type === 'bandit_camp' && <BanditTile />}
        {!isDetected && type === 'debris_field' && <DebrisTile />}
      </div>
      <div className={`text-[8px] font-semibold text-center max-w-[70px] leading-tight ${labelColor}`}>
        {isDetected ? entry.coordinates : entry.name ?? entry.location_type?.replace(/_/g, ' ') ?? entry.coordinates}
      </div>
    </div>
  )
}

function Minimap({
  locations,
  homeCoords,
  camX,
  camY,
  viewportW,
  viewportH,
  onScrollHome,
  panelOpen,
}: {
  locations: GalaxyMapEntry[]
  homeCoords: string
  camX: number
  camY: number
  viewportW: number
  viewportH: number
  onScrollHome: () => void
  panelOpen: boolean
}) {
  const vpW = (viewportW / CANVAS_W) * 100
  const vpH = (viewportH / CANVAS_H) * 100
  const vpX = (camX / CANVAS_W) * 100
  const vpY = (camY / CANVAS_H) * 100

  const dotColor = (entry: GalaxyMapEntry) => {
    if (entry.visibility === 'detected') return 'bg-yellow-500/40'
    switch (entry.location_type) {
      case 'asteroid_field': return 'bg-amber-400'
      case 'bandit_camp': return 'bg-red-500'
      case 'debris_field': return 'bg-slate-500'
      default: return 'bg-slate-600'
    }
  }

  return (
    <div
      data-clickable
      className="absolute right-3 w-[180px] h-[120px] rounded-md border border-slate-700/15 overflow-hidden z-[30] transition-[bottom] duration-[250ms] ease-out"
      style={{ background: 'rgba(8,8,20,0.85)', bottom: panelOpen ? '154px' : '12px' }}
    >
      {/* Location dots */}
      {locations.map((entry) => {
        const pos = coordsToPosition(entry.coordinates, homeCoords)
        return (
          <div
            key={`mm-${entry.id}`}
            className={`absolute w-[3px] h-[3px] rounded-full ${dotColor(entry)}`}
            style={{ left: `${(pos.x / CANVAS_W) * 100}%`, top: `${(pos.y / CANVAS_H) * 100}%` }}
          />
        )
      })}
      {/* Home dot */}
      <div
        className="absolute w-[5px] h-[5px] rounded-full bg-indigo-400"
        style={{ left: `${(HOME_X / CANVAS_W) * 100}%`, top: `${(HOME_Y / CANVAS_H) * 100}%`, transform: 'translate(-50%,-50%)' }}
      />
      {/* Viewport indicator */}
      <div
        className="absolute border border-indigo-500/40 rounded-sm"
        style={{
          width: `${vpW}%`, height: `${vpH}%`,
          left: `${vpX}%`, top: `${vpY}%`,
          background: 'rgba(99,102,241,0.08)',
        }}
      />
      {/* Home button */}
      <button
        onClick={onScrollHome}
        className="absolute bottom-1 right-1.5 text-[7px] text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded hover:bg-indigo-500/20 transition-colors"
      >
        Home
      </button>
    </div>
  )
}

function DetailPanel({
  entry,
  sending,
  probeCount,
  onSendProbe,
  onNavigateMission,
  onDeselect,
}: {
  entry: GalaxyMapEntry
  sending: boolean
  probeCount: number
  onSendProbe: (coords: string) => void
  onNavigateMission: (coords: string, type: string) => void
  onDeselect: () => void
}) {
  const isDetected = entry.visibility === 'detected'
  const type = entry.location_type
  const meta = entry.metadata as Record<string, unknown>

  const typeLabel = type === 'asteroid_field' ? 'Asteroid Field'
    : type === 'bandit_camp' ? 'Bandit Camp'
    : type === 'debris_field' ? 'Debris Field'
    : 'Unknown'

  const titleColor = isDetected ? 'text-yellow-500/80'
    : type === 'asteroid_field' ? 'text-amber-400'
    : type === 'bandit_camp' ? 'text-red-400'
    : type === 'debris_field' ? 'text-slate-300'
    : 'text-slate-400'

  const badgeBg = isDetected ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600'
    : type === 'asteroid_field' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600'
    : type === 'bandit_camp' ? 'bg-red-500/10 border-red-500/20 text-red-600'
    : type === 'debris_field' ? 'bg-slate-400/10 border-slate-400/15 text-slate-500'
    : 'bg-slate-600/10 border-slate-600/20 text-slate-500'

  const description = isDetected
    ? 'A faint signal detected at these coordinates. Send a probe to reveal what lies here.'
    : type === 'asteroid_field'
      ? 'A cluster of mineral-rich asteroids. Send a mining fleet to extract resources.'
      : type === 'bandit_camp'
        ? `A ${(meta?.size as string) ?? 'unknown'} bandit encampment. Raid it for resources, but expect armed resistance.`
        : type === 'debris_field'
          ? 'Wreckage from a past battle. Deploy cargo ships to salvage valuable materials.'
          : ''

  const size = (meta?.size as string) ?? 'medium'
  const threat = size === 'small' ? 'Low' : size === 'medium' ? 'Medium' : 'High'

  return (
    <div
      data-clickable
      className="absolute bottom-0 left-0 right-0 z-[25] border-t border-slate-700/15 px-5 py-4 backdrop-blur-xl transition-transform duration-[250ms] ease-out"
      style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(8,12,20,0.98))' }}
    >
      <div className="flex gap-6 items-start">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[15px] font-bold ${titleColor}`}>
              {isDetected ? 'Unknown Signal' : entry.name ?? typeLabel}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded border font-medium ${badgeBg}`}>
              {isDetected ? 'Detected' : typeLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{description}</p>
          <div className="flex gap-5 mt-2.5">
            {!isDetected && type === 'asteroid_field' && (
              <div>
                <div className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Richness</div>
                <div className="text-[13px] font-semibold text-amber-400">{(meta?.richness as number) ?? '?'} / 5</div>
              </div>
            )}
            {!isDetected && type === 'bandit_camp' && (
              <>
                <div>
                  <div className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Size</div>
                  <div className="text-[13px] font-semibold text-red-400 capitalize">{size}</div>
                </div>
                <div>
                  <div className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Threat</div>
                  <div className="text-[13px] font-semibold text-red-300">{threat}</div>
                </div>
              </>
            )}
            {!isDetected && type === 'debris_field' && (
              <div>
                <div className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Est. Salvage</div>
                <div className="text-[13px] font-semibold text-slate-300">~{(meta?.salvage_metal as number) ?? '?'} metal</div>
              </div>
            )}
            <div>
              <div className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Coordinates</div>
              <div className="text-[12px] font-medium text-slate-300 font-mono">{entry.coordinates}</div>
            </div>
            {!isDetected && (
              <div>
                <div className="text-[8px] text-slate-600 uppercase tracking-wide mb-0.5">Status</div>
                <div className="text-[12px] font-semibold text-green-400">Active</div>
              </div>
            )}
          </div>
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0 w-[170px]">
          {isDetected && (
            <button
              onClick={() => onSendProbe(entry.coordinates)}
              disabled={sending || probeCount === 0}
              className="w-full py-2 text-[11px] font-semibold rounded-lg text-yellow-300 border border-yellow-500/30 disabled:opacity-40 transition-colors"
              style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.35), rgba(180,130,6,0.45))' }}
            >
              {sending ? 'Sending...' : probeCount === 0 ? 'No Probes' : 'Send Probe'}
            </button>
          )}
          {!isDetected && type === 'asteroid_field' && (
            <button
              onClick={() => onNavigateMission(entry.coordinates, 'mining')}
              className="w-full py-2 text-[11px] font-semibold rounded-lg text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', boxShadow: '0 2px 8px rgba(217,119,6,0.25)' }}
            >
              Send Mining Fleet
            </button>
          )}
          {!isDetected && type === 'bandit_camp' && (
            <button
              onClick={() => onNavigateMission(entry.coordinates, 'raid')}
              className="w-full py-2 text-[11px] font-semibold rounded-lg text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', boxShadow: '0 2px 8px rgba(220,38,38,0.25)' }}
            >
              Send Raid Fleet
            </button>
          )}
          {!isDetected && type === 'debris_field' && (
            <button
              onClick={() => onNavigateMission(entry.coordinates, 'salvage')}
              className="w-full py-2 text-[11px] font-semibold rounded-lg text-slate-100 transition-colors"
              style={{ background: 'linear-gradient(135deg, #475569, #334155)' }}
            >
              Send Salvage Fleet
            </button>
          )}
          <button
            onClick={onDeselect}
            className="w-full py-1.5 text-[10px] text-slate-500 hover:text-slate-300 bg-slate-700/30 border border-slate-600/12 rounded-lg transition-colors"
          >
            Deselect
          </button>
        </div>
      </div>
    </div>
  )
}

function HomePlanet({ name, coords }: { name: string; coords: string }) {
  return (
    <div
      className="absolute flex flex-col items-center gap-1.5 z-10"
      style={{ left: HOME_X, top: HOME_Y, transform: 'translate(-50%, -50%)' }}
    >
      {/* Outer orbit ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[150px] h-[150px] rounded-full border border-indigo-500/[0.04] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[110px] h-[110px] rounded-full border border-indigo-500/[0.08] pointer-events-none" />
      {/* HOME label */}
      <div className="absolute -top-4 text-[7px] text-indigo-500/40 tracking-[1.5px] uppercase">HOME</div>
      {/* Planet sphere */}
      <div
        className="w-20 h-20 rounded-full relative overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #6366f1 0%, #3730a3 40%, #1e1b4b 80%)',
          boxShadow: '0 0 50px rgba(99,102,241,0.25), 0 0 100px rgba(99,102,241,0.1), inset -8px -8px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div className="absolute w-[18px] h-[7px] bg-indigo-400/30 rounded-full top-[25%] left-[20%] -rotate-[20deg]" />
        <div className="absolute w-[26px] h-[8px] bg-indigo-500/20 rounded-full top-[55%] left-[35%] rotate-[10deg]" />
        <div className="absolute w-[12px] h-[5px] bg-indigo-300/15 rounded-full top-[38%] left-[55%]" />
      </div>
      {/* Labels */}
      <div className="text-[11px] font-bold text-indigo-300">{name}</div>
      <div className="text-[8px] text-indigo-500 font-mono">{coords}</div>
    </div>
  )
}

function MissionDot({
  mission,
  homeCoords,
}: {
  mission: { id: string; mission_type: string; target_coords: string; dispatched_at: string; returns_at: string }
  homeCoords: string
}) {
  const dispatched = new Date(mission.dispatched_at).getTime()
  const returns = new Date(mission.returns_at).getTime()
  const now = Date.now()
  const total = returns - dispatched
  const progress = Math.min(1, Math.max(0, (now - dispatched) / total))

  const targetPos = coordsToPosition(mission.target_coords, homeCoords)

  let x: number, y: number
  if (progress <= 0.5) {
    const t = progress * 2
    x = HOME_X + (targetPos.x - HOME_X) * t
    y = HOME_Y + (targetPos.y - HOME_Y) * t
  } else {
    const t = (progress - 0.5) * 2
    x = targetPos.x + (HOME_X - targetPos.x) * t
    y = targetPos.y + (HOME_Y - targetPos.y) * t
  }

  const color = mission.mission_type === 'mining' ? '#f59e0b'
    : mission.mission_type === 'raid' ? '#ef4444'
    : '#22d3ee'

  const glowColor = mission.mission_type === 'mining' ? 'rgba(245,158,11,0.4)'
    : mission.mission_type === 'raid' ? 'rgba(239,68,68,0.4)'
    : 'rgba(34,211,238,0.4)'

  return (
    <div
      className="absolute z-[8] pointer-events-none transition-all duration-[5000ms] ease-linear"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      {/* Outer pulse ring */}
      <div
        className="absolute inset-0 rounded-full animate-ping"
        style={{ background: glowColor, width: 10, height: 10, margin: -2 }}
      />
      {/* Dot */}
      <div
        className="w-[6px] h-[6px] rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${glowColor}` }}
      />
    </div>
  )
}

export function GalaxyMapPage() {
  const { planet, galaxyMap, buildings, shipFleet, refetch, activeMissions } = useOutletContext<GameContext>()
  const navigate = useNavigate()

  const [camX, setCamX] = useState(0)
  const [camY, setCamY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selected, setSelected] = useState<GalaxyMapEntry | null>(null)
  const [sending, setSending] = useState(false)
  const [searchCoords, setSearchCoords] = useState('')
  const [searchError, setSearchError] = useState('')

  const dragStart = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const radarLevel = buildings.find((b) => b.building_id === 'radar_array')?.level ?? 0

  const visibleLocations = useMemo(
    () => galaxyMap.filter((e) => !e.cleared_at),
    [galaxyMap]
  )

  const detectedCount = visibleLocations.filter((e) => e.visibility === 'detected').length
  const revealedCount = visibleLocations.filter((e) => e.visibility === 'revealed').length

  // Center on home planet on mount
  useEffect(() => {
    if (!wrapRef.current) return
    const ww = wrapRef.current.clientWidth
    const wh = wrapRef.current.clientHeight
    setCamX(HOME_X - ww / 2)
    setCamY(HOME_Y - wh / 2)
  }, [])

  // Tick every 5s to update mission dot positions
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const clamp = useCallback((x: number, y: number) => {
    const w = wrapRef.current?.clientWidth ?? 800
    const h = wrapRef.current?.clientHeight ?? 600
    return {
      x: Math.max(0, Math.min(CANVAS_W - w, x)),
      y: Math.max(0, Math.min(CANVAS_H - h, y)),
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-clickable]')) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, camX, camY }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [camX, camY])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    const clamped = clamp(dragStart.current.camX - dx, dragStart.current.camY - dy)
    setCamX(clamped.x)
    setCamY(clamped.y)
  }, [isDragging, clamp])

  const onPointerUp = useCallback(() => {
    setIsDragging(false)
    dragStart.current = null
  }, [])

  const scrollToHome = useCallback(() => {
    if (!wrapRef.current) return
    const clamped = clamp(HOME_X - wrapRef.current.clientWidth / 2, HOME_Y - wrapRef.current.clientHeight / 2)
    setCamX(clamped.x)
    setCamY(clamped.y)
  }, [clamp])

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

  const handleSearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const target = searchCoords.trim()
    if (!target) return
    const entry = visibleLocations.find((loc) => loc.coordinates === target)
    if (entry) {
      const pos = coordsToPosition(entry.coordinates, planet.coordinates)
      const w = wrapRef.current?.clientWidth ?? 800
      const h = wrapRef.current?.clientHeight ?? 600
      const clamped = clamp(pos.x - w / 2, pos.y - h / 2)
      setCamX(clamped.x)
      setCamY(clamped.y)
      setSelected(entry)
      setSearchError('')
    } else if (target === planet.coordinates) {
      scrollToHome()
      setSearchError('')
    } else {
      setSearchError('No location at those coordinates')
      setTimeout(() => setSearchError(''), 2000)
    }
  }, [searchCoords, visibleLocations, planet.coordinates, clamp, scrollToHome])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/20">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">Galaxy Map</h1>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {detectedCount} detected · {revealedCount} revealed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchCoords}
              onChange={(e) => setSearchCoords(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="1:3:5"
              className="w-24 px-2 py-1 text-[10px] font-mono bg-slate-900/60 border border-slate-700/30 rounded text-slate-300 placeholder:text-slate-600 focus:border-indigo-500/40 focus:outline-none"
            />
            {searchError && (
              <div className="absolute top-full mt-1 left-0 text-[9px] text-red-400 whitespace-nowrap z-50">{searchError}</div>
            )}
          </div>
          <button
            onClick={handleRunRadar}
            disabled={radarLevel < 1 || sending}
            className="px-3 py-1.5 text-[10px] font-medium rounded bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {radarLevel < 1 ? 'Build Radar Array' : 'Run Radar Scan'}
          </button>
        </div>
      </div>

      {/* Canvas viewport */}
      <div
        ref={wrapRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="absolute"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `translate(${-camX}px, ${-camY}px)`,
            background: `
              radial-gradient(ellipse at 35% 40%, rgba(99,102,241,0.04) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 65%, rgba(168,85,247,0.03) 0%, transparent 45%),
              #05050f
            `,
          }}
        >
          {/* Stars layer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 42px 83px, rgba(255,255,255,0.5) 0%, transparent 100%),
                radial-gradient(1px 1px at 130px 210px, rgba(255,255,255,0.3) 0%, transparent 100%),
                radial-gradient(1.5px 1.5px at 210px 45px, rgba(255,255,255,0.4) 0%, transparent 100%),
                radial-gradient(1px 1px at 320px 170px, rgba(255,255,255,0.3) 0%, transparent 100%),
                radial-gradient(1px 1px at 95px 310px, rgba(255,255,255,0.5) 0%, transparent 100%),
                radial-gradient(1px 1px at 400px 90px, rgba(255,255,255,0.3) 0%, transparent 100%),
                radial-gradient(1px 1px at 180px 380px, rgba(255,255,255,0.4) 0%, transparent 100%),
                radial-gradient(1.5px 1.5px at 470px 260px, rgba(255,255,255,0.3) 0%, transparent 100%)
              `,
              backgroundSize: '500px 500px',
            }}
          />
          {/* Grid layer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(100,140,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(100,140,255,0.03) 1px, transparent 1px)',
              backgroundSize: '120px 120px',
            }}
          />

          {/* Connection lines + mission route lines */}
          <svg className="absolute inset-0 pointer-events-none z-[1]" width={CANVAS_W} height={CANVAS_H}>
            {visibleLocations.map((entry) => {
              const pos = coordsToPosition(entry.coordinates, planet.coordinates)
              const dx = pos.x - HOME_X
              const dy = pos.y - HOME_Y
              if (Math.sqrt(dx * dx + dy * dy) > CONNECTION_RADIUS) return null
              return (
                <line
                  key={`conn-${entry.id}`}
                  x1={HOME_X} y1={HOME_Y} x2={pos.x} y2={pos.y}
                  stroke="rgba(100,140,255,0.06)" strokeWidth={1} strokeDasharray="6,6"
                />
              )
            })}
            {activeMissions.map((mission) => {
              const pos = coordsToPosition(mission.target_coords, planet.coordinates)
              const color = mission.mission_type === 'mining' ? 'rgba(245,158,11,0.2)'
                : mission.mission_type === 'raid' ? 'rgba(239,68,68,0.2)'
                : 'rgba(34,211,238,0.2)'
              return (
                <line
                  key={`route-${mission.id}`}
                  x1={HOME_X} y1={HOME_Y} x2={pos.x} y2={pos.y}
                  stroke={color} strokeWidth={1} strokeDasharray="4,4"
                />
              )
            })}
          </svg>

          {/* Home planet */}
          <HomePlanet name={planet.name} coords={planet.coordinates} />

          {/* Mission dots */}
          {activeMissions.map((mission) => (
            <MissionDot
              key={mission.id}
              mission={mission}
              homeCoords={planet.coordinates}
            />
          ))}

          {/* Location nodes */}
          {visibleLocations.map((entry) => (
            <LocationNode
              key={entry.id}
              entry={entry}
              homeCoords={planet.coordinates}
              isSelected={selected?.id === entry.id}
              onSelect={() => setSelected(selected?.id === entry.id ? null : entry)}
            />
          ))}
        </div>

        {/* Empty state */}
        {visibleLocations.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-slate-600 text-sm">
              {radarLevel < 1
                ? 'Build a Radar Array to start detecting coordinates.'
                : 'Run a radar scan to discover nearby coordinates.'}
            </div>
          </div>
        )}

        {/* Minimap */}
        <Minimap
          locations={visibleLocations}
          homeCoords={planet.coordinates}
          camX={camX}
          camY={camY}
          viewportW={wrapRef.current?.clientWidth ?? 800}
          viewportH={wrapRef.current?.clientHeight ?? 600}
          onScrollHome={scrollToHome}
          panelOpen={!!selected}
        />

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            entry={selected}
            sending={sending}
            probeCount={shipFleet.find((s) => s.ship_type === 'probe')?.count ?? 0}
            onSendProbe={handleSendProbe}
            onNavigateMission={(coords, type) => navigate(`/missions?target=${coords}&type=${type}`)}
            onDeselect={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}
