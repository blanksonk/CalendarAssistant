import { useQuery } from '@tanstack/react-query'
import { fetchEvents, type CalendarEvent } from '../api/calendar'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from '../utils/dates'

export type TimeRange = 'week' | 'month'
export type DisplayMode = 'calendar' | 'radial'

export function useCalendar(timeRange: TimeRange, referenceDate: Date) {
  const { start, end } = getDateRange(timeRange, referenceDate)

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', 'events', start.toISOString(), end.toISOString()],
    queryFn: () => fetchEvents(start, end),
    staleTime: 10 * 1000,         // 10s — short so focus refetch always triggers
    refetchInterval: 30 * 1000,   // background sync every 30s
    refetchOnWindowFocus: true,   // refresh when user tabs back after editing externally
  })

  return { events, isLoading, start, end }
}

function getDateRange(range: TimeRange, ref: Date): { start: Date; end: Date } {
  if (range === 'week') {
    return { start: startOfWeek(ref), end: endOfWeek(ref) }
  }
  return { start: startOfMonth(ref), end: endOfMonth(ref) }
}
