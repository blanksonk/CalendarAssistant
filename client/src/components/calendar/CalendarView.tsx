import { useState } from 'react'
import { useCalendar, type CalendarView as View } from '../../hooks/useCalendar'
import { usePendingEventsStore, type PendingEvent } from '../../store/pendingEventsStore'
import type { CalendarEvent } from '../../api/calendar'
import { addDays, formatShortDate, startOfWeek, startOfMonth } from '../../utils/dates'
import { StatsBar } from './StatsBar'
import { WeekGrid } from './WeekGrid'
import { MonthGrid } from './MonthGrid'
import { RadialView } from './RadialView'

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void
  onPendingClick?: (event: PendingEvent) => void
}

export function CalendarView({ onEventClick, onPendingClick }: CalendarViewProps) {
  const [view, setView] = useState<View>('week')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const pendingEvents = usePendingEventsStore((s) => s.events)

  const { events, start, end } = useCalendar(view, referenceDate)

  const rangeLabel = buildRangeLabel(view, referenceDate)

  const handlePrev = () => setReferenceDate(navigate(view, referenceDate, -1))
  const handleNext = () => setReferenceDate(navigate(view, referenceDate, 1))

  return (
    <div data-testid="calendar-view" className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-2 bg-white border-b border-gray-100">
        {(['week', 'month', 'radial'] as View[]).map((v) => (
          <button
            key={v}
            data-testid={`tab-${v}`}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors capitalize ${
              view === v
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <StatsBar
        events={events}
        rangeLabel={rangeLabel}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {/* Calendar panel */}
      <div className="flex-1 overflow-hidden">
        {view === 'week' && (
          <WeekGrid
            referenceDate={referenceDate}
            events={events}
            pendingEvents={pendingEvents}
            onEventClick={onEventClick}
            onPendingClick={onPendingClick}
          />
        )}
        {view === 'month' && (
          <MonthGrid
            referenceDate={referenceDate}
            events={events}
            pendingEvents={pendingEvents}
            onEventClick={onEventClick}
            onPendingClick={onPendingClick}
          />
        )}
        {view === 'radial' && (
          <RadialView
            referenceDate={referenceDate}
            events={events}
            pendingEvents={pendingEvents}
            onEventClick={onEventClick}
            onPendingClick={onPendingClick}
          />
        )}
      </div>
    </div>
  )
}

function buildRangeLabel(view: View, ref: Date): string {
  if (view === 'week' || view === 'radial') {
    const mon = startOfWeek(ref)
    const sun = addDays(mon, 6)
    return `${formatShortDate(mon)} – ${formatShortDate(sun)}`
  }
  return ref.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function navigate(view: View, ref: Date, dir: -1 | 1): Date {
  if (view === 'week' || view === 'radial') {
    return addDays(ref, dir * 7)
  }
  const d = new Date(ref)
  d.setMonth(d.getMonth() + dir)
  return d
}
