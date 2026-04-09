import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RadialView } from './RadialView'
import type { CalendarEvent } from '../../api/calendar'
import type { PendingEvent } from '../../store/pendingEventsStore'

const MONDAY = new Date(2026, 3, 6) // April 6, 2026

function makeEvent(dayOffset: number, hour: number): CalendarEvent {
  const start = new Date(MONDAY)
  start.setDate(start.getDate() + dayOffset)
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(hour + 1)
  return {
    id: `evt-d${dayOffset}-h${hour}`,
    summary: `Meeting`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}

function makePending(dayOffset: number): PendingEvent {
  const start = new Date(MONDAY)
  start.setDate(start.getDate() + dayOffset)
  start.setHours(14, 0, 0, 0)
  const end = new Date(start)
  end.setHours(15)
  return { id: `pending-d${dayOffset}`, title: 'Pending', start, end }
}

describe('RadialView', () => {
  it('renders the radial view container', () => {
    render(<RadialView referenceDate={MONDAY} events={[]} pendingEvents={[]} />)
    expect(screen.getByTestId('radial-view')).toBeInTheDocument()
  })

  it('renders an SVG element', () => {
    render(<RadialView referenceDate={MONDAY} events={[]} pendingEvents={[]} />)
    expect(screen.getByTestId('radial-svg')).toBeInTheDocument()
  })

  it('renders 5 day segments for Mon–Fri', () => {
    render(<RadialView referenceDate={MONDAY} events={[]} pendingEvents={[]} />)
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`day-segment-${i}`)).toBeInTheDocument()
    }
  })

  it('renders event arcs for events in the current week', () => {
    const event = makeEvent(0, 10) // Monday 10am
    render(<RadialView referenceDate={MONDAY} events={[event]} pendingEvents={[]} />)
    expect(screen.getByTestId(`radial-event-${event.id}`)).toBeInTheDocument()
  })

  it('renders ghost arc for pending events', () => {
    const pending = makePending(2) // Wednesday
    render(<RadialView referenceDate={MONDAY} events={[]} pendingEvents={[pending]} />)
    expect(screen.getByTestId(`radial-ghost-${pending.id}`)).toBeInTheDocument()
  })

  it('ghost arc has dashed stroke style', () => {
    const pending = makePending(1) // Tuesday
    render(<RadialView referenceDate={MONDAY} events={[]} pendingEvents={[pending]} />)
    const ghost = screen.getByTestId(`radial-ghost-${pending.id}`)
    expect(ghost.getAttribute('stroke-dasharray')).toBeTruthy()
  })

  it('renders event label for events >= 30 minutes in zoomed day view', () => {
    const event = makeEvent(0, 10) // 1-hour event on Monday (dayIdx 0)
    render(
      <RadialView
        referenceDate={MONDAY}
        events={[event]}
        pendingEvents={[]}
        zoomedDay={0}
        onZoomDay={() => {}}
      />
    )
    expect(screen.getByTestId(`radial-event-label-${event.id}`)).toBeInTheDocument()
  })

  it('does not render event labels in the week (unzoomed) view', () => {
    const event = makeEvent(0, 10) // 1-hour event on Monday
    render(<RadialView referenceDate={MONDAY} events={[event]} pendingEvents={[]} />)
    expect(screen.queryByTestId(`radial-event-label-${event.id}`)).not.toBeInTheDocument()
  })

  it('renders hour labels in zoomed day view', () => {
    render(
      <RadialView
        referenceDate={MONDAY}
        events={[]}
        pendingEvents={[]}
        zoomedDay={0}
        onZoomDay={() => {}}
      />
    )
    // Labels at 3-hour intervals: 6am, 9am, 12pm, 3pm, 6pm, 9pm
    expect(screen.getByTestId('hour-label-6')).toBeInTheDocument()
    expect(screen.getByTestId('hour-label-9')).toBeInTheDocument()
    expect(screen.getByTestId('hour-label-12')).toBeInTheDocument()
    expect(screen.getByTestId('hour-label-21')).toBeInTheDocument()
  })
})
