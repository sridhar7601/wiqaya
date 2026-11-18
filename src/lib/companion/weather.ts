import { useEffect, useState } from 'react'
import type { City } from './exposures'
import { CITIES } from './exposures'

/**
 * Today's heat for the person's city, from Open-Meteo (free, no key, no account). Only the city's fixed
 * coordinates are sent, never the phone's location, and only after the person turned heat alerts on.
 */
export interface Heat {
  maxC: number
  feelsC: number
  uv: number
}

export async function fetchHeat(city: City): Promise<Heat | null> {
  const c = CITIES.find((x) => x.value === city)
  if (!c) return null
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&daily=temperature_2m_max,apparent_temperature_max,uv_index_max&timezone=Asia%2FDubai&forecast_days=1`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const j = (await res.json()) as { daily?: { temperature_2m_max?: number[]; apparent_temperature_max?: number[]; uv_index_max?: number[] } }
    const maxC = j.daily?.temperature_2m_max?.[0]
    const feelsC = j.daily?.apparent_temperature_max?.[0]
    const uv = j.daily?.uv_index_max?.[0]
    return typeof maxC === 'number' && typeof feelsC === 'number' ? { maxC, feelsC, uv: typeof uv === 'number' ? uv : 0 } : null
  } catch {
    return null
  }
}

/** Fetched once per city per page visit. */
export function useHeat(city: City | undefined, allowed: boolean): Heat | null | 'loading' {
  const [heat, setHeat] = useState<Heat | null | 'loading'>(city && allowed ? 'loading' : null)
  useEffect(() => {
    if (!city || !allowed) return
    let alive = true
    void fetchHeat(city).then((h) => {
      if (alive) setHeat(h)
    })
    return () => {
      alive = false
    }
  }, [city, allowed])
  return city && allowed ? heat : null
}

/** "Strong heat" for an outdoor worker: feels like 40 °C or more. Above 46 °C is "extreme". */
export const heatLevel = (h: Heat): 'none' | 'strong' | 'extreme' => (h.feelsC >= 46 ? 'extreme' : h.feelsC >= 40 ? 'strong' : 'none')
