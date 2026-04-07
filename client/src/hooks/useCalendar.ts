import { useQuery } from '@tanstack/react-query'
import { fetchEvents, type CalendarEvent } from '../api/calendar'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from '../utils/dates'

export type CalendarView = 'week' | 'month' | 'radial'

export function useCalendar(view: CalendarView, referenceDate: Date) {
  const { start, end } = getDateRange(view, referenceDate)

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', 'events', start.toISOString(), end.toISOString()],
    queryFn: () => fetchEvents(start, end),
    staleTime: 2 * 60 * 1000,
  })

  return { events, isLoading, start, end }
}

function getDateRange(view: CalendarView, ref: Date): { start: Date; end: Date } {
  if (view === 'week' || view === 'radial') {
    return { start: startOfWeek(ref), end: endOfWeek(ref) }
  }
  return { start: startOfMonth(ref), end: endOfMonth(ref) }
}
