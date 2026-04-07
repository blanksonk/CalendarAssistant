import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { CalendarEvent } from '../../api/calendar'
import type { PendingEvent } from '../../store/pendingEventsStore'
import type { TimeRange } from '../../hooks/useCalendar'
import { addDays, parseEventDate, startOfWeek } from '../../utils/dates'
import { eventColorClass } from '../../utils/eventColors'

interface RadialViewProps {
  referenceDate: Date
  timeRange?: TimeRange
  events: CalendarEvent[]
  pendingEvents: PendingEvent[]
  zoomedDay?: number | null
  onZoomDay?: (day: number | null) => void
  onEventClick?: (event: CalendarEvent) => void
  onPendingClick?: (event: PendingEvent) => void
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TOTAL_HOURS = 24
const INNER_R = 60 // center circle radius
const OUTER_R = 230 // outer edge

export function RadialView({
  referenceDate,
  timeRange = 'week',
  events,
  pendingEvents,
  zoomedDay = null,
  onZoomDay = () => {},
  onEventClick,
  onPendingClick,
}: RadialViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const monday = startOfWeek(referenceDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  // Month mode: build list of weeks in the month
  const monthWeeks = buildMonthWeeks(referenceDate)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const SIZE = 520
    const cx = SIZE / 2
    const cy = SIZE / 2
    svg.attr('viewBox', `0 0 ${SIZE} ${SIZE}`).attr('width', '100%').attr('height', '100%')
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`)

    if (timeRange === 'week') {
      if (zoomedDay === null) {
        renderFullWeek(g, weekDays, events, pendingEvents, onEventClick, onPendingClick, onZoomDay)
      } else {
        renderZoomedDay(g, weekDays[zoomedDay], zoomedDay, events, pendingEvents, onEventClick, onPendingClick, () => onZoomDay(null))
      }
    } else {
      if (zoomedDay === null) {
        renderMonthRadial(g, monthWeeks, referenceDate, events, pendingEvents, onEventClick, onPendingClick, onZoomDay)
      } else {
        // Zoomed into a week — show that week's days as a full-week radial
        const weekDaysZoomed = monthWeeks[zoomedDay]
        renderFullWeek(g, weekDaysZoomed, events, pendingEvents, onEventClick, onPendingClick, (idx) => {
          if (idx === -1) onZoomDay(null)
        }, true)
      }
    }
  }, [referenceDate, timeRange, events, pendingEvents, zoomedDay])

  return (
    <div data-testid="radial-view" className="flex items-center justify-center h-full w-full">
      <svg ref={svgRef} data-testid="radial-svg" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Month radial: weeks as outer segments, click to zoom into a week
// ---------------------------------------------------------------------------

function renderMonthRadial(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  weeks: Date[][],
  referenceDate: Date,
  events: CalendarEvent[],
  pendingEvents: PendingEvent[],
  onEventClick?: (e: CalendarEvent) => void,
  onPendingClick?: (e: PendingEvent) => void,
  onWeekClick?: (weekIdx: number) => void,
) {
  const numWeeks = weeks.length

  const weekArc = d3.arc<{ weekIdx: number }>()
    .innerRadius(INNER_R)
    .outerRadius(OUTER_R)
    .startAngle((d) => (d.weekIdx / numWeeks) * 2 * Math.PI - Math.PI / 2)
    .endAngle((d) => ((d.weekIdx + 1) / numWeeks) * 2 * Math.PI - Math.PI / 2)

  weeks.forEach((week, weekIdx) => {
    // Count events in this week
    const weekEventCount = events.filter((e) =>
      week.some((d) => d.toDateString() === parseEventDate(e.start).toDateString())
    ).length

    const intensity = Math.min(weekEventCount / 6, 1) // normalize 0–6 events
    const fill = d3.interpolateBlues(0.1 + intensity * 0.5)

    g.append('path')
      .datum({ weekIdx })
      .attr('d', weekArc)
      .attr('fill', fill)
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .attr('data-testid', `week-segment-${weekIdx}`)
      .on('click', () => onWeekClick?.(weekIdx))

    // Week label
    const midAngle = ((weekIdx + 0.5) / numWeeks) * 2 * Math.PI - Math.PI / 2
    const labelR = OUTER_R + 20
    const monday = week[0]
    g.append('text')
      .attr('x', labelR * Math.cos(midAngle))
      .attr('y', labelR * Math.sin(midAngle))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text(`Apr ${monday.getDate()}`)

    // Event count badge inside segment
    if (weekEventCount > 0) {
      const badgeR = (INNER_R + OUTER_R) / 2
      g.append('text')
        .attr('x', badgeR * Math.cos(midAngle))
        .attr('y', badgeR * Math.sin(midAngle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', '600')
        .attr('fill', '#1e40af')
        .text(weekEventCount)
    }
  })

  // Center label
  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '11px')
    .attr('fill', '#64748b')
    .text(referenceDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 16)
    .attr('font-size', '9px')
    .attr('fill', '#94a3b8')
    .text('click week to zoom')
}

// ---------------------------------------------------------------------------
// Full week: 5 pie slices (day segments), each with hour rings
// ---------------------------------------------------------------------------

function renderFullWeek(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  days: Date[],
  events: CalendarEvent[],
  pendingEvents: PendingEvent[],
  onEventClick?: (e: CalendarEvent) => void,
  onPendingClick?: (e: PendingEvent) => void,
  onDayClick?: (dayIdx: number) => void,
  isZoomedWeek = false,
) {
  const numDays = days.length
  const dayArc = d3.arc<{ dayIdx: number }>()
    .innerRadius(INNER_R)
    .outerRadius(OUTER_R)
    .startAngle((d) => (d.dayIdx / numDays) * 2 * Math.PI - Math.PI / 2)
    .endAngle((d) => ((d.dayIdx + 1) / numDays) * 2 * Math.PI - Math.PI / 2)

  // Day background slices
  days.forEach((day, dayIdx) => {
    g.append('path')
      .datum({ dayIdx })
      .attr('d', dayArc)
      .attr('fill', dayIdx % 2 === 0 ? '#f8fafc' : '#f1f5f9')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1)
      .attr('cursor', 'pointer')
      .attr('data-testid', `day-segment-${dayIdx}`)
      .on('click', () => onDayClick?.(dayIdx))

    // Day label
    const midAngle = ((dayIdx + 0.5) / numDays) * 2 * Math.PI - Math.PI / 2
    const labelR = OUTER_R + 18
    g.append('text')
      .attr('x', labelR * Math.cos(midAngle))
      .attr('y', labelR * Math.sin(midAngle))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#64748b')
      .text(DAY_NAMES[dayIdx])
  })

  // Event arcs
  events.forEach((event) => {
    const start = parseEventDate(event.start)
    const end = parseEventDate(event.end)
    const dayIdx = days.findIndex((d) => d.toDateString() === start.toDateString())
    if (dayIdx < 0) return

    const arc = buildEventArc(dayIdx, numDays, start, end)
    const colors = eventColorClass(event)
    const fill = tailwindColorToHex(colors.bg, false)

    g.append('path')
      .attr('d', arc as string)
      .attr('fill', fill)
      .attr('fill-opacity', 0.85)
      .attr('stroke', tailwindColorToHex(colors.border, true))
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .attr('data-testid', `radial-event-${event.id}`)
      .on('click', (e: MouseEvent) => {
        e.stopPropagation()
        onEventClick?.(event)
      })
  })

  // Pending event arcs (pulsing, semi-transparent)
  pendingEvents.forEach((pending) => {
    const dayIdx = days.findIndex((d) => d.toDateString() === pending.start.toDateString())
    if (dayIdx < 0) return

    const arc = buildEventArc(dayIdx, numDays, pending.start, pending.end)

    const path = g.append('path')
      .attr('d', arc as string)
      .attr('fill', '#3b82f6')
      .attr('fill-opacity', 0.3)
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,2')
      .attr('cursor', 'pointer')
      .attr('data-testid', `radial-ghost-${pending.id}`)
      .on('click', (e: MouseEvent) => {
        e.stopPropagation()
        onPendingClick?.(pending)
      })

    // Pulse animation
    path.append('animate')
      .attr('attributeName', 'fill-opacity')
      .attr('values', '0.3;0.6;0.3')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite')
  })

  // Center label
  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#94a3b8')
    .text(isZoomedWeek ? 'click day' : 'click day')

  if (isZoomedWeek) {
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 14)
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .attr('cursor', 'pointer')
      .text('← back')
      .on('click', () => onDayClick?.(-1)) // -1 = back signal
  }
}

// ---------------------------------------------------------------------------
// Zoomed day: single day fills full circle, hours as rings
// ---------------------------------------------------------------------------

function renderZoomedDay(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  day: Date,
  dayIdx: number,
  events: CalendarEvent[],
  pendingEvents: PendingEvent[],
  onEventClick?: (e: CalendarEvent) => void,
  onPendingClick?: (e: PendingEvent) => void,
  onBack?: () => void
) {
  const dayEvents = events.filter(
    (e) => parseEventDate(e.start).toDateString() === day.toDateString()
  )
  const dayPending = pendingEvents.filter(
    (p) => p.start.toDateString() === day.toDateString()
  )

  // Background ring
  g.append('circle')
    .attr('r', OUTER_R)
    .attr('fill', '#f8fafc')
    .attr('stroke', '#e2e8f0')
    .attr('cursor', 'pointer')
    .on('click', () => onBack?.())

  // Hour rings (only business hours 6-22 rendered for clarity)
  const HOUR_MIN = 6
  const HOUR_MAX = 22
  const HOUR_RANGE = HOUR_MAX - HOUR_MIN

  for (let h = HOUR_MIN; h <= HOUR_MAX; h++) {
    const r = INNER_R + ((h - HOUR_MIN) / HOUR_RANGE) * (OUTER_R - INNER_R)
    g.append('circle')
      .attr('r', r)
      .attr('fill', 'none')
      .attr('stroke', h % 6 === 0 ? '#cbd5e1' : '#f1f5f9')
      .attr('stroke-width', 0.5)
  }

  // Event arcs for zoomed day
  const renderArc = (start: Date, end: Date) => {
    const startFrac = (start.getHours() + start.getMinutes() / 60 - HOUR_MIN) / HOUR_RANGE
    const endFrac = (end.getHours() + end.getMinutes() / 60 - HOUR_MIN) / HOUR_RANGE
    const startAngle = startFrac * 2 * Math.PI - Math.PI / 2
    const endAngle = endFrac * 2 * Math.PI - Math.PI / 2

    return d3.arc()({
      innerRadius: INNER_R + 4,
      outerRadius: OUTER_R - 4,
      startAngle,
      endAngle,
    })
  }

  dayEvents.forEach((event) => {
    const start = parseEventDate(event.start)
    const end = parseEventDate(event.end)
    const colors = eventColorClass(event)

    g.append('path')
      .attr('d', renderArc(start, end) as string)
      .attr('fill', tailwindColorToHex(colors.bg, false))
      .attr('fill-opacity', 0.85)
      .attr('stroke', tailwindColorToHex(colors.border, true))
      .attr('stroke-width', 1)
      .attr('cursor', 'pointer')
      .attr('data-testid', `zoomed-event-${event.id}`)
      .on('click', () => onEventClick?.(event))
  })

  dayPending.forEach((pending) => {
    g.append('path')
      .attr('d', renderArc(pending.start, pending.end) as string)
      .attr('fill', '#3b82f6')
      .attr('fill-opacity', 0.3)
      .attr('stroke', '#3b82f6')
      .attr('stroke-dasharray', '4,2')
      .attr('cursor', 'pointer')
      .attr('data-testid', `zoomed-ghost-${pending.id}`)
      .on('click', () => onPendingClick?.(pending))
  })

  // Day label in center
  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '13px')
    .attr('font-weight', '600')
    .attr('fill', '#334155')
    .text(DAY_NAMES[dayIdx])

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 18)
    .attr('font-size', '9px')
    .attr('fill', '#94a3b8')
    .attr('cursor', 'pointer')
    .text('← back')
    .on('click', () => onBack?.())
}

// ---------------------------------------------------------------------------
// Arc builder for an event within a day slice
// ---------------------------------------------------------------------------

function buildEventArc(dayIdx: number, numDays: number, start: Date, end: Date): string | null {
  const dayStartAngle = (dayIdx / numDays) * 2 * Math.PI - Math.PI / 2
  const dayEndAngle = ((dayIdx + 1) / numDays) * 2 * Math.PI - Math.PI / 2
  const daySpan = dayEndAngle - dayStartAngle

  const startHourFrac = (start.getHours() + start.getMinutes() / 60) / TOTAL_HOURS
  const endHourFrac = (end.getHours() + end.getMinutes() / 60) / TOTAL_HOURS

  const r1 = INNER_R + startHourFrac * (OUTER_R - INNER_R)
  const r2 = INNER_R + endHourFrac * (OUTER_R - INNER_R)

  return d3.arc()({
    innerRadius: Math.min(r1, r2),
    outerRadius: Math.max(r1, r2) + 8,
    startAngle: dayStartAngle + daySpan * 0.05,
    endAngle: dayEndAngle - daySpan * 0.05,
  })
}

// Very simple Tailwind → hex mapper for D3 fill/stroke
function tailwindColorToHex(cls: string, isBorder: boolean): string {
  if (cls.includes('blue')) return isBorder ? '#60a5fa' : '#dbeafe'
  if (cls.includes('purple')) return isBorder ? '#a78bfa' : '#ede9fe'
  if (cls.includes('orange')) return isBorder ? '#fb923c' : '#ffedd5'
  if (cls.includes('red')) return isBorder ? '#f87171' : '#fee2e2'
  return isBorder ? '#2dd4bf' : '#ccfbf1' // teal default
}

/** Build weeks (Mon–Sun arrays) covering the reference month */
export function buildMonthWeeks(date: Date): Date[][] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  // Find the Monday on or before the 1st
  const startDay = new Date(firstOfMonth)
  const dow = startDay.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  startDay.setDate(startDay.getDate() + diff)

  const weeks: Date[][] = []
  const cursor = new Date(startDay)

  while (cursor <= lastOfMonth || weeks.length < 4) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    if (cursor > lastOfMonth && weeks.length >= 4) break
  }
  return weeks
}
