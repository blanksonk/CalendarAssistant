import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { CalendarEvent } from '../../api/calendar'
import type { PendingEvent } from '../../store/pendingEventsStore'
import type { TimeRange } from '../../hooks/useCalendar'
import { addDays, parseEventDate, startOfWeek } from '../../utils/dates'
import { eventColorClass } from '../../utils/eventColors'

interface TooltipState {
  event: CalendarEvent
  x: number
  y: number
}

type SetTooltip = (t: TooltipState | null) => void

interface RadialViewProps {
  referenceDate: Date
  timeRange?: TimeRange
  events: CalendarEvent[]
  pendingEvents: PendingEvent[]
  zoomedDay?: number | null
  onZoomDay?: (day: number | null) => void
  zoomedDayOfWeek?: number | null
  onZoomDayOfWeek?: (day: number | null) => void
  onEventClick?: (event: CalendarEvent) => void
  onPendingClick?: (event: PendingEvent) => void
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const INNER_R = 60
const OUTER_R = 230

export function RadialView({
  referenceDate,
  timeRange = 'week',
  events,
  pendingEvents,
  zoomedDay = null,
  onZoomDay = () => {},
  zoomedDayOfWeek = null,
  onZoomDayOfWeek = () => {},
  onEventClick,
  onPendingClick,
}: RadialViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const monday = startOfWeek(referenceDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const monthWeeks = buildMonthWeeks(referenceDate)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Day view needs a larger canvas so leader-line labels have room
    const isDayView =
      (timeRange === 'week' && zoomedDay !== null) ||
      (timeRange !== 'week' && zoomedDay !== null && zoomedDayOfWeek !== null)
    const SIZE = isDayView ? 700 : 520
    svg.attr('viewBox', `0 0 ${SIZE} ${SIZE}`).attr('width', '100%').attr('height', '100%')
    const g = svg.append('g').attr('transform', `translate(${SIZE / 2},${SIZE / 2})`)

    if (timeRange === 'week') {
      if (zoomedDay === null) {
        renderFullWeek(
          g, weekDays, events, pendingEvents,
          onEventClick, onPendingClick,
          (idx) => onZoomDay(idx), undefined, setTooltip
        )
      } else {
        renderZoomedDay(
          g, weekDays[zoomedDay], zoomedDay, events, pendingEvents,
          onEventClick, onPendingClick, () => onZoomDay(null)
        )
      }
    } else {
      // Month mode: 3-level drill (month → week → day)
      if (zoomedDay === null) {
        renderMonthRadial(
          g, monthWeeks, referenceDate, events, pendingEvents,
          onEventClick, onPendingClick, onZoomDay
        )
      } else if (zoomedDayOfWeek === null) {
        // Zoomed into a week — show 7-day radial
        const weekDaysZoomed = monthWeeks[zoomedDay]
        renderFullWeek(
          g, weekDaysZoomed, events, pendingEvents,
          onEventClick, onPendingClick,
          (idx) => onZoomDayOfWeek(idx), () => onZoomDay(null), setTooltip, true
        )
      } else {
        // Zoomed into a specific day within a month-week
        const day = monthWeeks[zoomedDay][zoomedDayOfWeek]
        renderZoomedDay(
          g, day, zoomedDayOfWeek, events, pendingEvents,
          onEventClick, onPendingClick, () => onZoomDayOfWeek(null)
        )
      }
    }
  }, [referenceDate, timeRange, events, pendingEvents, zoomedDay, zoomedDayOfWeek])

  return (
    <div
      data-testid="radial-view"
      className="flex items-center justify-center h-full w-full"
      onMouseLeave={() => setTooltip(null)}
    >
      <svg ref={svgRef} data-testid="radial-svg" />

      {/* Hover tooltip for week/month arc events */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs"
          style={{ left: tooltip.x + 14, top: tooltip.y - 40 }}
        >
          <div className="font-semibold text-gray-800 max-w-[180px] truncate">
            {tooltip.event.summary}
          </div>
          <div className="text-gray-400 mt-0.5">{formatEventTime(tooltip.event)}</div>
        </div>
      )}
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
  _pendingEvents: PendingEvent[],
  _onEventClick?: (e: CalendarEvent) => void,
  _onPendingClick?: (e: PendingEvent) => void,
  onWeekClick?: (weekIdx: number) => void,
) {
  const numWeeks = weeks.length

  const weekArc = d3.arc<{ weekIdx: number }>()
    .innerRadius(INNER_R)
    .outerRadius(OUTER_R)
    .startAngle((d) => (d.weekIdx / numWeeks) * 2 * Math.PI)
    .endAngle((d) => ((d.weekIdx + 1) / numWeeks) * 2 * Math.PI)

  weeks.forEach((week, weekIdx) => {
    const weekEventCount = events.filter((e) =>
      week.some((d) => d.toDateString() === parseEventDate(e.start).toDateString())
    ).length

    const intensity = Math.min(weekEventCount / 6, 1)
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
      .text(`${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)

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
// Full week: day segments as pie slices. No text labels on arcs — use tooltip.
// ---------------------------------------------------------------------------

function renderFullWeek(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  days: Date[],
  events: CalendarEvent[],
  pendingEvents: PendingEvent[],
  onEventClick?: (e: CalendarEvent) => void,
  onPendingClick?: (e: PendingEvent) => void,
  onDayClick?: (dayIdx: number) => void,
  onBack?: () => void,
  setTooltip?: SetTooltip,
  isZoomedWeek = false,
) {
  const numDays = days.length
  const dayArc = d3.arc<{ dayIdx: number }>()
    .innerRadius(INNER_R)
    .outerRadius(OUTER_R)
    .startAngle((d) => (d.dayIdx / numDays) * 2 * Math.PI)
    .endAngle((d) => ((d.dayIdx + 1) / numDays) * 2 * Math.PI)

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

    const midAngle = ((dayIdx + 0.5) / numDays) * 2 * Math.PI - Math.PI / 2
    const labelR = OUTER_R + 18
    g.append('text')
      .attr('x', labelR * Math.cos(midAngle))
      .attr('y', labelR * Math.sin(midAngle))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#64748b')
      .text(DAY_NAMES[dayIdx] ?? day.toLocaleDateString('en-US', { weekday: 'short' }))
  })

  // Event arcs — hover tooltip only, no inline labels
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
      .on('mouseover', (e: MouseEvent) => setTooltip?.({ event, x: e.clientX, y: e.clientY }))
      .on('mousemove', (e: MouseEvent) => setTooltip?.({ event, x: e.clientX, y: e.clientY }))
      .on('mouseout', () => setTooltip?.(null))
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
    .text('click day')

  if (isZoomedWeek) {
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 14)
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .attr('cursor', 'pointer')
      .text('← back')
      .on('click', () => onBack?.())
  }
}

// ---------------------------------------------------------------------------
// Zoomed day: clock face — 12am at top, hours go clockwise as angles.
// Events are donut slices; labels rendered outside via leader lines.
//
// Angle conventions:
//   D3 arc: startAngle=0 → top (12 o'clock), increases clockwise.
//           Formula: (hour / 24) * 2π
//   SVG coords (Math.cos/sin): 0 → right (3 o'clock), -π/2 → top.
//           Formula: (hour / 24) * 2π  - π/2
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

  // Outer background circle — clicking zooms back
  g.append('circle')
    .attr('r', OUTER_R)
    .attr('fill', '#f8fafc')
    .attr('stroke', '#e2e8f0')
    .attr('stroke-width', 1)
    .attr('cursor', 'pointer')
    .on('click', () => onBack?.())

  // Inner hub
  g.append('circle')
    .attr('r', INNER_R)
    .attr('fill', 'white')
    .attr('stroke', '#e2e8f0')
    .attr('stroke-width', 1)

  // Hour marks and labels (SVG angle = D3 angle - π/2 so 0h=top)
  for (let h = 0; h < 24; h++) {
    const svgAngle = (h / 24) * 2 * Math.PI - Math.PI / 2  // for Math.cos/sin coords
    const isMajor = h % 6 === 0
    const isMinor = h % 3 === 0

    if (isMinor) {
      const lineStart = isMajor ? INNER_R : OUTER_R - 10
      g.append('line')
        .attr('x1', lineStart * Math.cos(svgAngle))
        .attr('y1', lineStart * Math.sin(svgAngle))
        .attr('x2', OUTER_R * Math.cos(svgAngle))
        .attr('y2', OUTER_R * Math.sin(svgAngle))
        .attr('stroke', isMajor ? '#cbd5e1' : '#e2e8f0')
        .attr('stroke-width', isMajor ? 1 : 0.5)
        .attr('pointer-events', 'none')

      const labelR = OUTER_R + 16
      const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
      g.append('text')
        .attr('x', labelR * Math.cos(svgAngle))
        .attr('y', labelR * Math.sin(svgAngle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '8px')
        .attr('fill', isMajor ? '#64748b' : '#94a3b8')
        .attr('pointer-events', 'none')
        .attr('data-testid', `hour-label-${h}`)
        .text(label)
    }
  }

  // Event donut slices
  // D3 arc angles: 0 = top (12am), increases clockwise → (hour/24)*2π (no offset)
  dayEvents.forEach((event) => {
    const start = parseEventDate(event.start)
    const end = parseEventDate(event.end)
    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60
    if (endHour <= startHour) return

    const d3Start = (startHour / 24) * 2 * Math.PI
    const d3End = (endHour / 24) * 2 * Math.PI
    const colors = eventColorClass(event)

    g.append('path')
      .attr('d', d3.arc()({
        innerRadius: INNER_R + 2,
        outerRadius: OUTER_R - 2,
        startAngle: d3Start,
        endAngle: d3End,
      }) as string)
      .attr('fill', tailwindColorToHex(colors.bg, false))
      .attr('fill-opacity', 0.85)
      .attr('stroke', tailwindColorToHex(colors.border, true))
      .attr('stroke-width', 1)
      .attr('cursor', 'pointer')
      .attr('data-testid', `zoomed-event-${event.id}`)
      .on('click', () => onEventClick?.(event))
      .append('title').text(event.summary)
  })

  // Pending event slices
  dayPending.forEach((pending) => {
    const startHour = pending.start.getHours() + pending.start.getMinutes() / 60
    const endHour = pending.end.getHours() + pending.end.getMinutes() / 60
    if (endHour <= startHour) return

    g.append('path')
      .attr('d', d3.arc()({
        innerRadius: INNER_R + 2,
        outerRadius: OUTER_R - 2,
        startAngle: (startHour / 24) * 2 * Math.PI,
        endAngle: (endHour / 24) * 2 * Math.PI,
      }) as string)
      .attr('fill', '#3b82f6')
      .attr('fill-opacity', 0.3)
      .attr('stroke', '#3b82f6')
      .attr('stroke-dasharray', '4,2')
      .attr('cursor', 'pointer')
      .attr('data-testid', `zoomed-ghost-${pending.id}`)
      .on('click', () => onPendingClick?.(pending))
  })

  // Leader lines + labels rendered AFTER arcs so they sit on top
  dayEvents.forEach((event) => {
    const start = parseEventDate(event.start)
    const end = parseEventDate(event.end)
    const durationMins = (end.getTime() - start.getTime()) / 60000
    if (durationMins < 15) return

    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60

    // Midpoint in D3 angle space, then convert to SVG coords
    const d3Mid = ((startHour + endHour) / 2 / 24) * 2 * Math.PI
    const svgMid = d3Mid - Math.PI / 2  // shift so 0h=top

    const lineEndR = OUTER_R + 30
    const isRight = Math.cos(svgMid) >= 0
    const elbowLen = 28

    const x1 = (OUTER_R - 2) * Math.cos(svgMid)
    const y1 = (OUTER_R - 2) * Math.sin(svgMid)
    const x2 = lineEndR * Math.cos(svgMid)
    const y2 = lineEndR * Math.sin(svgMid)
    const x3 = x2 + (isRight ? elbowLen : -elbowLen)
    const y3 = y2

    // Radial segment
    g.append('line')
      .attr('x1', x1).attr('y1', y1)
      .attr('x2', x2).attr('y2', y2)
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 0.8)
      .attr('pointer-events', 'none')

    // Horizontal elbow
    g.append('line')
      .attr('x1', x2).attr('y1', y2)
      .attr('x2', x3).attr('y2', y3)
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 0.8)
      .attr('pointer-events', 'none')

    // Event name
    g.append('text')
      .attr('x', x3 + (isRight ? 3 : -3))
      .attr('y', y3 - 3)
      .attr('text-anchor', isRight ? 'start' : 'end')
      .attr('dominant-baseline', 'auto')
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('fill', '#334155')
      .attr('pointer-events', 'none')
      .attr('data-testid', `radial-event-label-${event.id}`)
      .text(event.summary)

    // Time range subtitle
    g.append('text')
      .attr('x', x3 + (isRight ? 3 : -3))
      .attr('y', y3 + 9)
      .attr('text-anchor', isRight ? 'start' : 'end')
      .attr('dominant-baseline', 'auto')
      .attr('font-size', '7.5px')
      .attr('fill', '#94a3b8')
      .attr('pointer-events', 'none')
      .text(`${fmtTime(start)} – ${fmtTime(end)}`)
  })

  // Center: day name + back link
  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '12px')
    .attr('font-weight', '600')
    .attr('fill', '#334155')
    .text(DAY_NAMES[dayIdx] ?? day.toLocaleDateString('en-US', { weekday: 'short' }))

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
// Arc builder for an event within a day slice (week radial)
// ---------------------------------------------------------------------------

function buildEventArc(dayIdx: number, numDays: number, start: Date, end: Date): string | null {
  // D3 arc angles: 0 = top (12 o'clock), no offset needed (unlike SVG Math.cos/sin)
  const dayStartAngle = (dayIdx / numDays) * 2 * Math.PI
  const dayEndAngle = ((dayIdx + 1) / numDays) * 2 * Math.PI
  const daySpan = dayEndAngle - dayStartAngle

  const startHourFrac = (start.getHours() + start.getMinutes() / 60) / 24
  const endHourFrac = (end.getHours() + end.getMinutes() / 60) / 24

  const r1 = INNER_R + startHourFrac * (OUTER_R - INNER_R)
  const r2 = INNER_R + endHourFrac * (OUTER_R - INNER_R)

  return d3.arc()({
    innerRadius: Math.min(r1, r2),
    outerRadius: Math.max(r1, r2) + 8,
    startAngle: dayStartAngle + daySpan * 0.05,
    endAngle: dayEndAngle - daySpan * 0.05,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tailwindColorToHex(cls: string, isBorder: boolean): string {
  if (cls.includes('blue')) return isBorder ? '#60a5fa' : '#dbeafe'
  if (cls.includes('purple')) return isBorder ? '#a78bfa' : '#ede9fe'
  if (cls.includes('orange')) return isBorder ? '#fb923c' : '#ffedd5'
  if (cls.includes('red')) return isBorder ? '#f87171' : '#fee2e2'
  return isBorder ? '#2dd4bf' : '#ccfbf1'
}

function fmtTime(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h < 12 ? 'am' : 'pm'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${displayH}${period}` : `${displayH}:${m.toString().padStart(2, '0')}${period}`
}

function formatEventTime(event: CalendarEvent): string {
  return `${fmtTime(parseEventDate(event.start))} – ${fmtTime(parseEventDate(event.end))}`
}

/** Build weeks (Mon–Sun arrays) covering the reference month */
export function buildMonthWeeks(date: Date): Date[][] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

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
