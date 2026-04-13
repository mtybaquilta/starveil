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

export function GalaxyMapPage() {
  const { planet, galaxyMap, buildings, refetch } = useOutletContext<GameContext>()

  const visibleLocations = useMemo(
    () => galaxyMap.filter((e) => !e.cleared_at),
    [galaxyMap]
  )

  const detectedCount = visibleLocations.filter((e) => e.visibility === 'detected').length
  const revealedCount = visibleLocations.filter((e) => e.visibility === 'revealed').length

  return (
    <div className="text-slate-400 text-sm p-4">
      Galaxy map skeleton — {detectedCount} detected, {revealedCount} revealed, {visibleLocations.length} total visible
    </div>
  )
}
