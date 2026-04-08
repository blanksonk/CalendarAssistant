import { useState } from 'react'
import type { CalendarEvent } from '../../api/calendar'
import { eventDurationMinutes } from '../../utils/dates'
import { useSettingsStore } from '../../store/settingsStore'

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

/**
 * Minutes of an event that overlap with the configured work window.
 * Handles midnight-crossing events and multi-day spans correctly.
 * Returns 0 for events entirely outside work hours.
 */
function workHourOverlapMins(event: CalendarEvent, workStartH: number, workEndH: number): number {
  if (!event.start.dateTime || !event.end.dateTime) return 0
  const start = new Date(event.start.dateTime)
  const end = new Date(event.end.dateTime)

  let total = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  while (cursor.getTime() < end.getTime()) {
    const workStart = new Date(cursor)
    workStart.setHours(workStartH, 0, 0, 0)
    const workEnd = new Date(cursor)
    workEnd.setHours(workEndH, 0, 0, 0)

    const overlapStart = Math.max(start.getTime(), workStart.getTime())
    const overlapEnd = Math.min(end.getTime(), workEnd.getTime())
    if (overlapEnd > overlapStart) {
      total += (overlapEnd - overlapStart) / 60000
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return total
}

function computeStats(
  events: CalendarEvent[],
  workdays: number,
  workStartH: number,
  workEndH: number,
): Stats {
  const timedEvents = events.filter((e) => !!e.start.dateTime)
  const meetingCount = timedEvents.length
  const totalMins = timedEvents.reduce(
    (sum, e) => sum + eventDurationMinutes(e.start, e.end),
    0
  )
  const totalMeetingHrs = Math.round((totalMins / 60) * 10) / 10
  const workOverlapMins = timedEvents.reduce(
    (sum, e) => sum + workHourOverlapMins(e, workStartH, workEndH),
    0
  )
  const workdayHrs = workEndH - workStartH
  const workdayMins = workdays * workdayHrs * 60
  const efficiencyPct = workdayMins > 0
    ? Math.min(100, Math.round((workOverlapMins / workdayMins) * 100))
    : 0
  return { meetingCount, totalMeetingHrs, efficiencyPct }
}

function fmtHour(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function StatsBar({ events, rangeLabel, onPrev, onNext, workdays = 5 }: StatsBarProps) {
  const { workStartHour, workEndHour, setWorkHours } = useSettingsStore()
  const { meetingCount, totalMeetingHrs, efficiencyPct } = computeStats(
    events, workdays, workStartHour, workEndHour
  )
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div
      data-testid="stats-bar"
      className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 relative"
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
        <Stat label="Meetings" value={String(meetingCount)} testId="stat-meeting-count" />
        <Stat label="Meeting hrs" value={String(totalMeetingHrs)} testId="stat-meeting-hrs" />

        {/* % of workday — click to configure work hours */}
        <div className="flex flex-col items-end relative">
          <span data-testid="stat-efficiency" className="text-sm font-semibold text-gray-800">
            {efficiencyPct}%
          </span>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
            title="Click to set your work hours"
          >
            % of workday · {fmtHour(workStartHour)}–{fmtHour(workEndHour)} ✎
          </button>

          {/* Work hours picker popover */}
          {showPicker && (
            <WorkHoursPicker
              startHour={workStartHour}
              endHour={workEndHour}
              onChange={(s, e) => { setWorkHours(s, e); setShowPicker(false) }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface WorkHoursPickerProps {
  startHour: number
  endHour: number
  onChange: (start: number, end: number) => void
  onClose: () => void
}

function WorkHoursPicker({ startHour, endHour, onChange, onClose }: WorkHoursPickerProps) {
  const [start, setStart] = useState(startHour)
  const [end, setEnd] = useState(endHour)

  const handleApply = () => {
    if (end > start) onChange(start, end)
  }

  return (
    <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-56">
      <p className="text-xs font-semibold text-gray-700 mb-3">Work hours</p>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex flex-col flex-1">
          <label className="text-[10px] text-gray-400 mb-1">Start</label>
          <select
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-200"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>{fmtHour(h)}</option>
            ))}
          </select>
        </div>

        <span className="text-gray-400 text-xs mt-4">→</span>

        <div className="flex flex-col flex-1">
          <label className="text-[10px] text-gray-400 mb-1">End</label>
          <select
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-200"
          >
            {HOURS.filter((h) => h > start).map((h) => (
              <option key={h} value={h}>{fmtHour(h)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="flex-1 text-xs py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col items-end">
      <span data-testid={testId} className="text-sm font-semibold text-gray-800">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}
