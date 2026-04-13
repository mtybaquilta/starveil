import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GameContext } from '../components/Layout'
import type { GalaxyMapEntry } from '../hooks/usePlanet'

const CANVAS_W = 2400
const CANVAS_H = 1600
const HOME_X = CANVAS_W / 2
const HOME_Y = CANVAS_H / 2
const SYSTEM_WIDTH = 400
const CONNECTION_RADIUS = 400

/** Simple seeded hash for deterministic jitter from entry ID */
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function parseCoords(coords: string): { galaxy: number; system: number; position: number } {
  const [g, s, p] = coords.split(':').map(Number)
  return { galaxy: g, system: s, position: p }
}

function coordsToPosition(
  coords: string,
  homeCoords: string,
  entryId: string
): { x: number; y: number } {
  const loc = parseCoords(coords)
  const home = parseCoords(homeCoords)

  const systemDelta = loc.system - home.system
  const positionDelta = loc.position - home.position

  const hash = hashId(entryId)
  const jitterX = ((hash % 100) - 50) * 1.5
  const jitterY = (((hash >> 8) % 100) - 50) * 1.5

  const x = HOME_X + systemDelta * SYSTEM_WIDTH + positionDelta * 40 + jitterX
  const y = HOME_Y + positionDelta * 100 + systemDelta * 30 + jitterY

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
  const pos = coordsToPosition(entry.coordinates, homeCoords, entry.id)
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

export function GalaxyMapPage() {
  const { planet, galaxyMap, buildings, refetch } = useOutletContext<GameContext>()
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
      const pos = coordsToPosition(entry.coordinates, planet.coordinates, entry.id)
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

          {/* Connection lines */}
          <svg className="absolute inset-0 pointer-events-none z-[1]" width={CANVAS_W} height={CANVAS_H}>
            {visibleLocations.map((entry) => {
              const pos = coordsToPosition(entry.coordinates, planet.coordinates, entry.id)
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
          </svg>

          {/* Home planet */}
          <HomePlanet name={planet.name} coords={planet.coordinates} />

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
      </div>
    </div>
  )
}
