import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type PlanetSummary = {
  id: string
  name: string
  coordinates: string
}

const STORAGE_KEY = 'starveil_selected_planet'

export function getStoredPlanetId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setStoredPlanetId(id: string) {
  localStorage.setItem(STORAGE_KEY, id)
}

export function usePlanets() {
  const [planets, setPlanets] = useState<PlanetSummary[]>([])
  const [selectedPlanetId, setSelectedPlanetIdState] = useState<string | null>(getStoredPlanetId())
  const [loading, setLoading] = useState(true)

  const fetchPlanets = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const playerId = sessionData.session?.user.id
    if (!playerId) { setLoading(false); return }

    const { data } = await supabase
      .from('planets')
      .select('id, name, coordinates')
      .eq('player_id', playerId)
      .order('created_at', { ascending: true })

    if (data && data.length > 0) {
      setPlanets(data)

      // If stored ID is invalid or unset, default to first planet
      const storedId = getStoredPlanetId()
      const validId = data.find((p) => p.id === storedId)?.id ?? data[0].id
      if (validId !== storedId) {
        setStoredPlanetId(validId)
      }
      setSelectedPlanetIdState(validId)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPlanets()
  }, [fetchPlanets])

  const selectPlanet = useCallback((id: string) => {
    setStoredPlanetId(id)
    setSelectedPlanetIdState(id)
  }, [])

  return { planets, selectedPlanetId, selectPlanet, loading, refetchPlanets: fetchPlanets }
}
