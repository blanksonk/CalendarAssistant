export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  attendees?: { email: string; displayName?: string; responseStatus?: string; self?: boolean }[]
  organizer?: { email: string; displayName?: string; self?: boolean }
  colorId?: string
  recurrence?: string[]
  recurringEventId?: string
  status?: string
}

export async function fetchEvents(start?: Date, end?: Date): Promise<CalendarEvent[]> {
  const params = new URLSearchParams()
  if (start) params.set('start', start.toISOString())
  if (end) params.set('end', end.toISOString())
  const res = await fetch(`/api/calendar/events?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch events')
  const data = await res.json()
  return data.events
}

export async function createEvent(params: {
  title: string
  start: Date
  end: Date
  attendees?: string[]
  description?: string
}): Promise<CalendarEvent> {
  const qs = new URLSearchParams({
    title: params.title,
    start: params.start.toISOString(),
    end: params.end.toISOString(),
  })
  if (params.description) qs.set('description', params.description)
  if (params.attendees?.length) params.attendees.forEach((a) => qs.append('attendees', a))

  const res = await fetch(`/api/calendar/events?${qs}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to create event')
  return res.json()
}
