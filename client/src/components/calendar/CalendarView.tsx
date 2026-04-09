import { useState, useEffect } from 'react'
import { useCalendar, type TimeRange, type DisplayMode } from '../../hooks/useCalendar'
import { usePendingEventsStore, type PendingEvent } from '../../store/pendingEventsStore'
import type { CalendarEvent } from '../../api/calendar'
import { addDays, formatShortDate, startOfWeek, parseEventDate } from '../../utils/dates'
import { StatsBar } from './StatsBar'
import { WeekGrid } from './WeekGrid'
import { MonthGrid } from './MonthGrid'
import { RadialView } from './RadialView'
import { buildMonthWeeks } from '../../utils/calendarWeeks'

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void
  onPendingClick?: (event: PendingEvent) => void
  requestedView?: { view: 'week' | 'day' | 'month'; date?: string | null } | null
  onRequestedViewConsumed?: () => void
}

export function CalendarView({ onEventClick, onPendingClick, requestedView, onRequestedViewConsumed }: CalendarViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('radial')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const [zoomedDay, setZoomedDay] = useState<number | null>(null)
  // Day within a zoomed week (month-radial only: month → week → day)
  const [zoomedDayOfWeek, setZoomedDayOfWeek] = useState<number | null>(null)
  const pendingEvents = usePendingEventsStore((s) => s.events)

  // Radial always uses month range for full month→week→day drill-through
  // without changing the user's timeRange preference for calendar views
  const effectiveTimeRange: TimeRange = displayMode === 'radial' ? 'month' : timeRange
  const { events } = useCalendar(effectiveTimeRange, referenceDate)

  // Handle switch_radial_view tool calls from the chat agent.
  // We do NOT use reset effects here — zoom is managed explicitly in each handler.
  useEffect(() => {
    if (!requestedView) return
    const targetDate = requestedView.date ? new Date(requestedView.date + 'T12:00:00') : new Date()

    let newZoomedDay: number | null = null
    let newZoomedDayOfWeek: number | null = null

    if (requestedView.view === 'week') {
      const weeks = buildMonthWeeks(targetDate)
      const weekIdx = weeks.findIndex((week) =>
        week.some((d) => d.toDateString() === targetDate.toDateString())
      )
      newZoomedDay = weekIdx >= 0 ? weekIdx : null
    } else if (requestedView.view === 'day') {
      const weeks = buildMonthWeeks(targetDate)
      let foundWeek = -1, foundDay = -1
      for (let wi = 0; wi < weeks.length; wi++) {
        const di = weeks[wi].findIndex((d) => d.toDateString() === targetDate.toDateString())
        if (di >= 0) { foundWeek = wi; foundDay = di; break }
      }
      if (foundWeek >= 0) { newZoomedDay = foundWeek; newZoomedDayOfWeek = foundDay }
    }

    setDisplayMode('radial')
    setReferenceDate(targetDate)
    setZoomedDay(newZoomedDay)
    setZoomedDayOfWeek(newZoomedDayOfWeek)
    onRequestedViewConsumed?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedView])

  // Derive what the StatsBar should display based on current zoom state
  let visibleEvents: CalendarEvent[] = events
  let visibleLabel: string = buildRangeLabel(effectiveTimeRange, referenceDate)
  let workdays: number = effectiveTimeRange === 'week' ? 5 : 20

  if (displayMode === 'radial' && zoomedDay !== null) {
    if (effectiveTimeRange === 'week') {
      // Week radial: zoomed into a single day
      const day = addDays(startOfWeek(referenceDate), zoomedDay)
      visibleEvents = events.filter(
        (e) => parseEventDate(e.start).toDateString() === day.toDateString()
      )
      visibleLabel = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      workdays = 1
    } else if (zoomedDayOfWeek !== null) {
      // Month radial: zoomed into a specific day within a week
      const weeks = buildMonthWeeks(referenceDate)
      const day = (weeks[zoomedDay] ?? [])[zoomedDayOfWeek]
      if (day) {
        visibleEvents = events.filter(
          (e) => parseEventDate(e.start).toDateString() === day.toDateString()
        )
        visibleLabel = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        workdays = 1
      }
    } else {
      // Month radial: zoomed into a week
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

  const handlePrev = () => {
    setZoomedDay(null); setZoomedDayOfWeek(null)
    setReferenceDate(navigate(effectiveTimeRange, referenceDate, -1))
  }
  const handleNext = () => {
    setZoomedDay(null); setZoomedDayOfWeek(null)
    setReferenceDate(navigate(effectiveTimeRange, referenceDate, 1))
  }

  return (
    <div data-testid="calendar-view" className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-white border-b border-gray-100 shrink-0">
        {/* Time range toggle — hidden in radial mode (radial navigates month→week→day internally) */}
        {displayMode !== 'radial' ? (
          <TogglePill
            options={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            value={timeRange}
            onChange={(v) => { setTimeRange(v as TimeRange); setZoomedDay(null); setZoomedDayOfWeek(null) }}
            testPrefix="time"
          />
        ) : (
          <div /> /* spacer to keep display toggle right-aligned */
        )}

        {/* Display mode toggle */}
        <TogglePill
          options={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'radial', label: 'Radial' },
          ]}
          value={displayMode}
          onChange={(v) => { setDisplayMode(v as DisplayMode); setZoomedDay(null); setZoomedDayOfWeek(null) }}
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
            timeRange={effectiveTimeRange}
            events={events}
            pendingEvents={pendingEvents}
            zoomedDay={zoomedDay}
            onZoomDay={(idx) => { setZoomedDay(idx); setZoomedDayOfWeek(null) }}
            zoomedDayOfWeek={zoomedDayOfWeek}
            onZoomDayOfWeek={setZoomedDayOfWeek}
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
