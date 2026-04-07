import { useMemo } from 'react'
import type { CalendarEvent } from '../../api/calendar'
import type { PendingEvent } from '../../store/pendingEventsStore'
import { addDays, parseEventDate, startOfWeek } from '../../utils/dates'
import { eventColorClass } from '../../utils/eventColors'

interface MonthGridProps {
  referenceDate: Date
  events: CalendarEvent[]
  pendingEvents: PendingEvent[]
  onEventClick?: (event: CalendarEvent) => void
  onPendingClick?: (event: PendingEvent) => void
}

export function MonthGrid({
  referenceDate,
  events,
  pendingEvents,
  onEventClick,
  onPendingClick,
}: MonthGridProps) {
  const weeks = useMemo(() => buildWeeks(referenceDate), [referenceDate.getMonth()])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = parseEventDate(event.start).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(event)
    }
    return map
  }, [events])

  const pendingByDate = useMemo(() => {
    const map = new Map<string, PendingEvent[]>()
    for (const event of pendingEvents) {
      const key = event.start.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(event)
    }
    return map
  }, [pendingEvents])

  const currentMonth = referenceDate.getMonth()

  return (
    <div data-testid="month-grid" className="flex flex-col h-full overflow-auto">
      {/* Day of week header */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} data-testid={`week-row-${wi}`} className="grid grid-cols-7 flex-1">
          {week.map((day, di) => {
            const isCurrentMonth = day.getMonth() === currentMonth
            const dateKey = day.toDateString()
            const dayEvents = eventsByDate.get(dateKey) ?? []
            const dayPending = pendingByDate.get(dateKey) ?? []

            return (
              <div
                key={di}
                data-testid={`month-day-${dateKey}`}
                className={`border-b border-r border-gray-100 p-1 min-h-[100px] ${
                  isCurrentMonth ? '' : 'bg-gray-50'
                }`}
              >
                <span
                  className={`text-xs font-medium ${
                    isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                  }`}
                >
                  {day.getDate()}
                </span>

                {/* Real event bars */}
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => {
                    const colors = eventColorClass(event)
                    return (
                      <div
                        key={event.id}
                        data-testid={`month-event-bar-${event.id}`}
                        onClick={() => onEventClick?.(event)}
                        className={`text-[10px] truncate px-1 rounded cursor-pointer ${colors.bg} ${colors.text}`}
                      >
                        {event.summary}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-gray-400">+{dayEvents.length - 3}</span>
                  )}
                </div>

                {/* Pending event lines (ghost style) */}
                {dayPending.map((pending) => (
                  <div
                    key={pending.id}
                    data-testid={`month-ghost-bar-${pending.id}`}
                    onClick={() => onPendingClick?.(pending)}
                    className="mt-0.5 text-[10px] truncate px-1 rounded cursor-pointer bg-blue-50/60 text-blue-500 opacity-70 border border-dashed border-blue-300"
                  >
                    {pending.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Build an array of weeks (each week = 7 Date objects, Mon–Sun) covering the full month */
function buildWeeks(date: Date): Date[][] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  const start = startOfWeek(firstOfMonth)
  const weeks: Date[][] = []

  let cursor = new Date(start)
  while (cursor <= lastOfMonth || weeks.length === 0) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
    if (cursor > lastOfMonth && weeks.length >= 4) break
  }
  return weeks
}
