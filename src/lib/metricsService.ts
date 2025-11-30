// analytics/src/metricsService.ts
import type { Kpi, SeriesPoint } from '../types'

const STORAGE_KEY = 'mfe_users_v1'

function readUsers(): { id: number; name: string; email: string; role: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function buildSeriesFromUsers(usersCount: number): SeriesPoint[] {
  const base = [
    { day: 'Mon', users: 120 },
    { day: 'Tue', users: 200 },
    { day: 'Wed', users: 150 },
    { day: 'Thu', users: 170 },
    { day: 'Fri', users: 220 },
    { day: 'Sat', users: 90 },
    { day: 'Sun', users: 60 },
  ]
  const factor = Math.max(0.5, usersCount / 10)
  return base.map(p => ({ day: p.day, users: Math.round(p.users * factor), errors: Math.round(Math.max(0, (p.users / 100) * (usersCount % 5))) }))
}

export const metricsService = {
  async fetchKpis(): Promise<Kpi[]> {
    await new Promise(r => setTimeout(r, 80))
    const users = readUsers()
    const total = users.length
    const active = Math.max(1, Math.round(total * 0.1))
    const errors = Math.floor(Math.random() * 3)
    return [
      { label: 'Users', value: `${total}`, delta: undefined },
      { label: 'Active', value: active, delta: undefined },
      { label: 'Errors', value: errors, delta: undefined }
    ]
  },

  async fetchSeries(): Promise<SeriesPoint[]> {
    await new Promise(r => setTimeout(r, 80))
    const users = readUsers()
    return buildSeriesFromUsers(users.length)
  }
}
