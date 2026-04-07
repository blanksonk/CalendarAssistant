import type { CalendarEvent } from '../../api/calendar'
import { eventDurationMinutes } from '../../utils/dates'

interface StatsBarProps {
  events: CalendarEvent[]
  rangeLabel: string
  onPrev: () => void
  onNext: () => void
  workdays?: number
}

interface Stats {
  meetingCount: number
  totalMeetingHrs: number
  efficiencyPct: number
}

function computeStats(events: CalendarEvent[], workdays: number): Stats {
  const meetingCount = events.length
  const totalMins = events.reduce(
    (sum, e) => sum + eventDurationMinutes(e.start, e.end),
    0
  )
  const totalMeetingHrs = Math.round((totalMins / 60) * 10) / 10
  // Efficiency: fraction of available work hours spent in meetings
  const workdayMins = workdays * 8 * 60
  const efficiencyPct = Math.min(100, Math.round((totalMins / workdayMins) * 100))
  return { meetingCount, totalMeetingHrs, efficiencyPct }
}

export function StatsBar({ events, rangeLabel, onPrev, onNext, workdays = 5 }: StatsBarProps) {
  const { meetingCount, totalMeetingHrs, efficiencyPct } = computeStats(events, workdays)

  return (
    <div
      data-testid="stats-bar"
      className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100"
    >
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          data-testid="prev-btn"
          onClick={onPrev}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 text-sm"
          aria-label="Previous"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-gray-700 min-w-32 text-center">
          {rangeLabel}
        </span>
        <button
          data-testid="next-btn"
          onClick={onNext}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 text-sm"
          aria-label="Next"
        >
          ›
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6">
        <Stat
          label="Meetings"
          value={String(meetingCount)}
          testId="stat-meeting-count"
        />
        <Stat
          label="Meeting hrs"
          value={String(totalMeetingHrs)}
          testId="stat-meeting-hrs"
        />
        <Stat
          label="Time blocked"
          value={`${efficiencyPct}%`}
          testId="stat-efficiency"
        />
      </div>
    </div>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col items-end">
      <span data-testid={testId} className="text-sm font-semibold text-gray-800">
        {value}
      </span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}
