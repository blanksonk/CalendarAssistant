import { useMemo } from 'react'
import type { CalendarEvent } from '../../api/calendar'
import type { PendingEvent } from '../../store/pendingEventsStore'
import { addDays, parseEventDate, startOfWeek, formatTime } from '../../utils/dates'
import { EventBlock } from './EventBlock'

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0–23
const DAYS = 7 // Mon–Sun

interface WeekGridProps {
  referenceDate: Date
  events: CalendarEvent[]
  pendingEvents: PendingEvent[]
  onEventClick?: (event: CalendarEvent) => void
  onPendingClick?: (event: PendingEvent) => void
}

export function WeekGrid({
  referenceDate,
  events,
  pendingEvents,
  onEventClick,
  onPendingClick,
}: WeekGridProps) {
  const monday = startOfWeek(referenceDate)
  const days = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => addDays(monday, i)),
    [monday.toDateString()]
  )

  // Map events to their day column (0=Mon … 4=Fri)
  const eventsByDay = useMemo(() => {
    const map: Map<number, CalendarEvent[]> = new Map(days.map((_, i) => [i, []]))
    for (const event of events) {
      const start = parseEventDate(event.start)
      const dayIdx = days.findIndex(
        (d) => d.toDateString() === start.toDateString()
      )
      if (dayIdx >= 0) map.get(dayIdx)!.push(event)
    }
    return map
  }, [events, days])

  const pendingByDay = useMemo(() => {
    const map: Map<number, PendingEvent[]> = new Map(days.map((_, i) => [i, []]))
    for (const event of pendingEvents) {
      const dayIdx = days.findIndex(
        (d) => d.toDateString() === event.start.toDateString()
      )
      if (dayIdx >= 0) map.get(dayIdx)!.push(event)
    }
    return map
  }, [pendingEvents, days])

  return (
    <div data-testid="week-grid" className="flex flex-col h-full overflow-hidden">
      {/* Day header row */}
      <div className="flex border-b border-gray-100">
        <div className="w-12 shrink-0" /> {/* time gutter */}
        {days.map((day, i) => (
          <div
            key={i}
            data-testid={`day-header-${i}`}
            className="flex-1 text-center py-2 text-xs font-medium text-gray-500 border-l border-gray-100"
          >
            {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex">
          {/* Time gutter */}
          <div className="w-12 shrink-0">
            {HOURS.map((h) => (
              <div key={h} className="h-14 flex items-start justify-end pr-2 pt-0.5">
                <span className="text-[10px] text-gray-400">
                  {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => (
            <div
              key={dayIdx}
              data-testid={`day-column-${dayIdx}`}
              className="flex-1 border-l border-gray-100 relative"
              style={{ minHeight: `${HOURS.length * 56}px` }}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div key={h} className="h-14 border-b border-gray-50" />
              ))}

              {/* Real events */}
              {eventsByDay.get(dayIdx)?.map((event) => {
                const style = eventPositionStyle(event.start, event.end)
                return (
                  <div
                    key={event.id}
                    className="absolute left-0.5 right-0.5"
                    style={style}
                  >
                    <EventBlock event={event} onClick={onEventClick} className="h-full text-xs" />
                  </div>
                )
              })}

              {/* Pending (ghost) events */}
              {pendingByDay.get(dayIdx)?.map((pending) => {
                const style = pendingPositionStyle(pending.start, pending.end)
                return (
                  <div
                    key={pending.id}
                    data-testid={`ghost-block-${pending.id}`}
                    className="absolute left-0.5 right-0.5 cursor-pointer"
                    style={style}
                    onClick={() => onPendingClick?.(pending)}
                  >
                    <div className="h-full rounded-md border-l-2 border-dashed border-blue-400 bg-blue-50/60 px-2 py-1 opacity-75">
                      <p className="text-xs font-semibold text-blue-700 truncate">{pending.title}</p>
                      <p className="text-xs text-blue-500">
                        {formatTime(pending.start)} – {formatTime(pending.end)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Convert event start/end to absolute CSS position within the day column */
function eventPositionStyle(
  start: { dateTime?: string; date?: string },
  end: { dateTime?: string; date?: string }
): React.CSSProperties {
  const s = parseEventDate(start)
  const e = parseEventDate(end)
  const startMinutes = s.getHours() * 60 + s.getMinutes()
  const durationMinutes = Math.max(30, (e.getTime() - s.getTime()) / 60000)
  const PX_PER_MIN = 56 / 60 // 56px per hour
  return {
    top: `${startMinutes * PX_PER_MIN}px`,
    height: `${durationMinutes * PX_PER_MIN}px`,
  }
}

function pendingPositionStyle(start: Date, end: Date): React.CSSProperties {
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000)
  const PX_PER_MIN = 56 / 60
  return {
    top: `${startMinutes * PX_PER_MIN}px`,
    height: `${durationMinutes * PX_PER_MIN}px`,
  }
}
