import { describe, it, expect } from 'vitest'
import { getWeatherForecast, ForecastDetail } from '../weather'

describe('getWeatherForecast', () => {
  const weather = {
    weatherType: 'solar_storm',
    metalMultiplier: 1.0,
    gasMultiplier: 1.0,
    energyMultiplier: 1.3,
    startsAt: new Date('2026-01-01T06:00:00Z'),
    expiresAt: new Date('2026-01-01T08:00:00Z'),
  }

  it('returns no_forecast for station level 0', () => {
    const result = getWeatherForecast(0, weather)
    expect(result.detail).toBe(ForecastDetail.None)
    expect(result.weatherType).toBeUndefined()
  })

  it('returns vague forecast for station levels 1-3', () => {
    const result = getWeatherForecast(2, weather)
    expect(result.detail).toBe(ForecastDetail.Vague)
    expect(result.message).toContain('changing soon')
    expect(result.weatherType).toBeUndefined()
  })

  it('returns type + approximate time for station levels 4-7', () => {
    const result = getWeatherForecast(5, weather)
    expect(result.detail).toBe(ForecastDetail.Approximate)
    expect(result.weatherType).toBe('solar_storm')
    expect(result.message).toContain('Solar Storm')
  })

  it('returns exact type, time, and duration for station levels 8-12', () => {
    const result = getWeatherForecast(10, weather)
    expect(result.detail).toBe(ForecastDetail.Exact)
    expect(result.weatherType).toBe('solar_storm')
    expect(result.startsAt).toEqual(weather.startsAt)
    expect(result.expiresAt).toEqual(weather.expiresAt)
  })

  it('returns multiplier values for station levels 13-17', () => {
    const result = getWeatherForecast(15, weather)
    expect(result.detail).toBe(ForecastDetail.Detailed)
    expect(result.multipliers).toEqual({
      metal: 1.0,
      gas: 1.0,
      energy: 1.3,
    })
  })

  it('returns full detail for station levels 18-20', () => {
    const result = getWeatherForecast(20, weather)
    expect(result.detail).toBe(ForecastDetail.Full)
    expect(result.multipliers).toBeDefined()
    expect(result.startsAt).toBeDefined()
  })
})
