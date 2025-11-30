

export type Kpi = {
  label: string
  value: number | string
  delta?: number
}

export type SeriesPoint = {
  day: string
  users: number
  errors?: number
}
