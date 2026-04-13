import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PlanetWeather } from './usePlanet'

export function useWeather(
  planetId: string | undefined,
  weather: PlanetWeather | null,
  onWeatherRotated: () => Promise<void>
) {
  const rotatingRef = useRef(false)

  const rotateWeather = useCallback(async () => {
    if (!planetId || rotatingRef.current) return
    rotatingRef.current = true
    try {
      await supabase.functions.invoke('game-action', {
        body: { action: 'rotate_weather', planetId },
      })
      await onWeatherRotated()
    } catch (err) {
      console.error('Failed to rotate weather:', err)
    } finally {
      rotatingRef.current = false
    }
  }, [planetId, onWeatherRotated])

  useEffect(() => {
    if (!weather || !planetId) return

    const checkExpiry = () => {
      if (!weather.expires_at) {
        // Null expiry means initial weather — rotate immediately
        rotateWeather()
        return
      }
      const remaining = new Date(weather.expires_at).getTime() - Date.now()
      if (remaining <= 0) {
        rotateWeather()
      }
    }

    // Check immediately on mount / weather change
    checkExpiry()

    // Then poll every 30 seconds
    const interval = setInterval(checkExpiry, 30_000)
    return () => clearInterval(interval)
  }, [weather, planetId, rotateWeather])
}
