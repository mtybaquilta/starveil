/**
 * weather-rotation
 *
 * Scheduled Edge Function — runs periodically (e.g., every 15 minutes).
 * For each planet whose current weather has expired, rolls a new weather
 * event and inserts it into planet_weather.
 *
 * Deploy schedule via Supabase Dashboard → Edge Functions → Cron trigger,
 * or via `supabase functions deploy weather-rotation --schedule "*/15 * * * *"`
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Must mirror src/config/weather.ts
const WEATHER_TYPES: {
  id: string
  metalMultiplier: number
  gasMultiplier: number
  energyMultiplier: number
  durationMinHours: number
  durationMaxHours: number
  weight: number
}[] = [
  { id: 'calm_skies',      metalMultiplier: 1.0,  gasMultiplier: 1.0,  energyMultiplier: 1.0,  durationMinHours: 4, durationMaxHours: 6, weight: 26.5 },
  { id: 'solar_flare',     metalMultiplier: 1.0,  gasMultiplier: 1.0,  energyMultiplier: 1.3,  durationMinHours: 2, durationMaxHours: 3, weight: 26.5 },
  { id: 'metal_vein',      metalMultiplier: 1.25, gasMultiplier: 1.0,  energyMultiplier: 1.0,  durationMinHours: 3, durationMaxHours: 4, weight: 10   },
  { id: 'gas_pocket',      metalMultiplier: 1.0,  gasMultiplier: 1.25, energyMultiplier: 1.0,  durationMinHours: 3, durationMaxHours: 4, weight: 10   },
  { id: 'ion_storm',       metalMultiplier: 1.0,  gasMultiplier: 0.8,  energyMultiplier: 0.6,  durationMinHours: 2, durationMaxHours: 3, weight: 10   },
  { id: 'dust_storm',      metalMultiplier: 0.7,  gasMultiplier: 1.0,  energyMultiplier: 0.85, durationMinHours: 2, durationMaxHours: 4, weight: 4    },
  { id: 'solar_storm',     metalMultiplier: 0.5,  gasMultiplier: 0.5,  energyMultiplier: 0.4,  durationMinHours: 1, durationMaxHours: 2, weight: 5    },
  { id: 'asteroid_shower', metalMultiplier: 1.8,  gasMultiplier: 0.6,  energyMultiplier: 0.9,  durationMinHours: 1, durationMaxHours: 1, weight: 4    },
  { id: 'nebula_drift',    metalMultiplier: 0.9,  gasMultiplier: 1.8,  energyMultiplier: 1.1,  durationMinHours: 1, durationMaxHours: 1, weight: 4    },
]

const TOTAL_WEIGHT = WEATHER_TYPES.reduce((s, w) => s + w.weight, 0)

function rollWeatherType() {
  let roll = Math.random() * TOTAL_WEIGHT
  for (const w of WEATHER_TYPES) {
    roll -= w.weight
    if (roll <= 0) return w
  }
  return WEATHER_TYPES[0]
}

function rollDurationHours(weatherType: typeof WEATHER_TYPES[0]): number {
  return weatherType.durationMinHours + Math.random() * (weatherType.durationMaxHours - weatherType.durationMinHours)
}

Deno.serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const now = new Date()

    // Find all planets whose current weather has expired
    const { data: expiredWeather, error } = await supabase
      .from('planet_weather')
      .select('planet_id')
      .lt('expires_at', now.toISOString())
      .not('expires_at', 'is', null)

    if (error) throw error
    if (!expiredWeather || expiredWeather.length === 0) {
      return new Response(JSON.stringify({ success: true, rotated: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let rotated = 0
    for (const row of expiredWeather) {
      const weather = rollWeatherType()
      const durationHours = rollDurationHours(weather)
      const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000)

      await supabase.from('planet_weather').insert({
        planet_id: row.planet_id,
        weather_type: weather.id,
        metal_multiplier: weather.metalMultiplier,
        gas_multiplier: weather.gasMultiplier,
        energy_multiplier: weather.energyMultiplier,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })

      await supabase.from('planet_events').insert({
        planet_id: row.planet_id,
        event_type: 'weather_changed',
        message: `Weather changed to ${weather.id.replace(/_/g, ' ')} — lasts ${Math.round(durationHours * 10) / 10}h`,
        metadata: { weather_type: weather.id, expires_at: expiresAt.toISOString() },
      })

      rotated++
    }

    return new Response(JSON.stringify({ success: true, rotated }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
