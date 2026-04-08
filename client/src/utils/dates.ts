/** Start of ISO week (Monday) for the given date */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** End of ISO week (Sunday 23:59:59) */
export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return end
}

/** First day of the month */
export function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/** First day of the next month (exclusive end) */
export function endOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Add N days to a date */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Format as "Mon Apr 7" */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Format as "9:00 AM" */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Parse an event's start/end to a Date (handles dateTime and all-day date strings) */
export function parseEventDate(dt: { dateTime?: string; date?: string }): Date {
  if (dt.dateTime) return new Date(dt.dateTime)
  if (dt.date) {
    // All-day events from Google have no time component (e.g. "2026-04-10").
    // new Date("2026-04-10") parses as UTC midnight, which shifts the date
    // back by 1 day in negative-UTC timezones. Use the local constructor instead.
    const [year, month, day] = dt.date.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(Date.now())
}

/** Duration of an event in minutes */
export function eventDurationMinutes(
  start: { dateTime?: string; date?: string },
  end: { dateTime?: string; date?: string }
): number {
  const s = parseEventDate(start).getTime()
  const e = parseEventDate(end).getTime()
  return Math.round((e - s) / 60000)
}
