import { useState } from 'react'
import { useCalendar, type TimeRange, type DisplayMode } from '../../hooks/useCalendar'
import { usePendingEventsStore, type PendingEvent } from '../../store/pendingEventsStore'
import type { CalendarEvent } from '../../api/calendar'
import { addDays, formatShortDate, startOfWeek } from '../../utils/dates'
import { StatsBar } from './StatsBar'
import { WeekGrid } from './WeekGrid'
import { MonthGrid } from './MonthGrid'
import { RadialView } from './RadialView'

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void
  onPendingClick?: (event: PendingEvent) => void
}

export function CalendarView({ onEventClick, onPendingClick }: CalendarViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('radial')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const pendingEvents = usePendingEventsStore((s) => s.events)

  const { events } = useCalendar(timeRange, referenceDate)

  const rangeLabel = buildRangeLabel(timeRange, referenceDate)
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
        events={events}
        rangeLabel={rangeLabel}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {/* Calendar panel */}
      <div className="flex-1 overflow-hidden">
        {displayMode === 'radial' ? (
          <RadialView
            referenceDate={referenceDate}
            timeRange={timeRange}
            events={events}
            pendingEvents={pendingEvents}
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
