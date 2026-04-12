export enum ForecastDetail {
  None = 'none',
  Vague = 'vague',
  Approximate = 'approximate',
  Exact = 'exact',
  Detailed = 'detailed',
  Full = 'full',
}

const WEATHER_NAMES: Record<string, string> = {
  calm_skies:      'Calm Skies',
  solar_flare:     'Solar Flare',
  metal_vein:      'Metal Vein Discovered',
  gas_pocket:      'Gas Pocket',
  ion_storm:       'Ion Storm',
  dust_storm:      'Dust Storm',
  solar_storm:     'Solar Storm',
  asteroid_shower: 'Asteroid Shower',
  nebula_drift:    'Nebula Drift',
}

type WeatherData = {
  weatherType: string
  metalMultiplier: number
  gasMultiplier: number
  energyMultiplier: number
  startsAt: Date
  expiresAt: Date | null
}

export type Forecast = {
  detail: ForecastDetail
  message: string
  weatherType?: string
  startsAt?: Date
  expiresAt?: Date | null
  multipliers?: { metal: number; gas: number; energy: number }
}

export function getWeatherForecast(
  stationLevel: number,
  weather: WeatherData
): Forecast {
  if (stationLevel <= 0) {
    return { detail: ForecastDetail.None, message: 'No weather data available.' }
  }

  if (stationLevel <= 3) {
    return {
      detail: ForecastDetail.Vague,
      message: 'Sensors detect weather changing soon...',
    }
  }

  const name = WEATHER_NAMES[weather.weatherType] ?? weather.weatherType

  if (stationLevel <= 7) {
    return {
      detail: ForecastDetail.Approximate,
      weatherType: weather.weatherType,
      message: `${name} detected in the coming hours.`,
    }
  }

  if (stationLevel <= 12) {
    return {
      detail: ForecastDetail.Exact,
      weatherType: weather.weatherType,
      startsAt: weather.startsAt,
      expiresAt: weather.expiresAt,
      message: `${name} — exact timing known.`,
    }
  }

  const multipliers = {
    metal: weather.metalMultiplier,
    gas: weather.gasMultiplier,
    energy: weather.energyMultiplier,
  }

  if (stationLevel <= 17) {
    return {
      detail: ForecastDetail.Detailed,
      weatherType: weather.weatherType,
      startsAt: weather.startsAt,
      expiresAt: weather.expiresAt,
      multipliers,
      message: `${name} — full analysis available.`,
    }
  }

  return {
    detail: ForecastDetail.Full,
    weatherType: weather.weatherType,
    startsAt: weather.startsAt,
    expiresAt: weather.expiresAt,
    multipliers,
    message: `${name} — extended forecast active.`,
  }
}
