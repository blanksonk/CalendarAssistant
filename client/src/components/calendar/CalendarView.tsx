import { useState, useEffect } from 'react'
import { useCalendar, type TimeRange, type DisplayMode } from '../../hooks/useCalendar'
import { usePendingEventsStore, type PendingEvent } from '../../store/pendingEventsStore'
import type { CalendarEvent } from '../../api/calendar'
import { addDays, formatShortDate, startOfWeek, parseEventDate } from '../../utils/dates'
import { StatsBar } from './StatsBar'
import { WeekGrid } from './WeekGrid'
import { MonthGrid } from './MonthGrid'
import { RadialView, buildMonthWeeks } from './RadialView'

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void
  onPendingClick?: (event: PendingEvent) => void
}

export function CalendarView({ onEventClick, onPendingClick }: CalendarViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('radial')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const [zoomedDay, setZoomedDay] = useState<number | null>(null)
  const pendingEvents = usePendingEventsStore((s) => s.events)

  const { events } = useCalendar(timeRange, referenceDate)

  // Reset zoom whenever the user navigates or changes view mode
  useEffect(() => { setZoomedDay(null) }, [timeRange, referenceDate, displayMode])

  // Derive what the StatsBar should display based on current zoom state
  let visibleEvents: CalendarEvent[] = events
  let visibleLabel: string = buildRangeLabel(timeRange, referenceDate)
  let workdays: number = timeRange === 'week' ? 5 : 20

  if (displayMode === 'radial' && zoomedDay !== null) {
    if (timeRange === 'week') {
      // Zoomed into a single day
      const day = addDays(startOfWeek(referenceDate), zoomedDay)
      visibleEvents = events.filter(
        (e) => parseEventDate(e.start).toDateString() === day.toDateString()
      )
      visibleLabel = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      workdays = 1
    } else {
      // Zoomed into a week within the month
      const weeks = buildMonthWeeks(referenceDate)
      const weekDays = weeks[zoomedDay] ?? []
      const dateStrings = new Set(weekDays.map((d) => d.toDateString()))
      visibleEvents = events.filter(
        (e) => dateStrings.has(parseEventDate(e.start).toDateString())
      )
      const mon = weekDays[0]
      const sun = weekDays[6]
      if (mon && sun) visibleLabel = `${formatShortDate(mon)} – ${formatShortDate(sun)}`
      workdays = 5
    }
  }

  const handlePrev = () => setReferenceDate(navigate(timeRange, referenceDate, -1))
  const handleNext = () => setReferenceDate(navigate(timeRange, referenceDate, 1))

  return (
    <div data-testid="calendar-view" className="flex flex-col h-full overflow-hidden">
      {/* Toolbar: two independent toggles */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-white border-b border-gray-100 shrink-0">
        {/* Time range toggle */}
        <TogglePill
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          value={timeRange}
          onChange={(v) => setTimeRange(v as TimeRange)}
          testPrefix="time"
        />

        {/* Display mode toggle */}
        <TogglePill
          options={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'radial', label: 'Radial' },
          ]}
          value={displayMode}
          onChange={(v) => setDisplayMode(v as DisplayMode)}
          testPrefix="display"
        />
      </div>

      {/* Stats bar with navigation */}
      <StatsBar
        events={visibleEvents}
        rangeLabel={visibleLabel}
        onPrev={handlePrev}
        onNext={handleNext}
        workdays={workdays}
      />

      {/* Calendar panel */}
      <div className="flex-1 overflow-hidden">
        {displayMode === 'radial' ? (
          <RadialView
            referenceDate={referenceDate}
            timeRange={timeRange}
            events={events}
            pendingEvents={pendingEvents}
            zoomedDay={zoomedDay}
            onZoomDay={setZoomedDay}
            onEventClick={onEventClick}
            onPendingClick={onPendingClick}
          />
        ) : timeRange === 'week' ? (
          <WeekGrid
            referenceDate={referenceDate}
            events={events}
            pendingEvents={pendingEvents}
            onEventClick={onEventClick}
            onPendingClick={onPendingClick}
          />
        ) : (
          <MonthGrid
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

// ---------------------------------------------------------------------------
// Toggle pill component
// ---------------------------------------------------------------------------

interface TogglePillProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  testPrefix: string
}

function TogglePill({ options, value, onChange, testPrefix }: TogglePillProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          data-testid={`${testPrefix}-toggle-${opt.value}`}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            value === opt.value
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRangeLabel(range: TimeRange, ref: Date): string {
  if (range === 'week') {
    const mon = startOfWeek(ref)
    const sun = addDays(mon, 6)
    return `${formatShortDate(mon)} – ${formatShortDate(sun)}`
  }
  return ref.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function navigate(range: TimeRange, ref: Date, dir: -1 | 1): Date {
  if (range === 'week') return addDays(ref, dir * 7)
  const d = new Date(ref)
  d.setMonth(d.getMonth() + dir)
  return d
}
