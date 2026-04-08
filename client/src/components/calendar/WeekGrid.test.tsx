import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekGrid } from './WeekGrid'
import type { CalendarEvent } from '../../api/calendar'
import type { PendingEvent } from '../../store/pendingEventsStore'

// Use local date constructor — avoids UTC-vs-local timezone issues
const MONDAY = new Date(2026, 3, 6) // April 6, 2026 — a Monday

function makeEvent(dayOffset: number = 0, hour: number = 10): CalendarEvent {
  const start = new Date(MONDAY)
  start.setDate(start.getDate() + dayOffset)
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(hour + 1)
  return {
    id: `evt-d${dayOffset}-h${hour}`,
    summary: `Event on day ${dayOffset}`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}

function makePending(dayOffset: number = 0): PendingEvent {
  const start = new Date(MONDAY)
  start.setDate(start.getDate() + dayOffset)
  start.setHours(14, 0, 0, 0)
  const end = new Date(start)
  end.setHours(15)
  return { id: `pending-d${dayOffset}`, title: 'Pending meeting', start, end }
}

describe('WeekGrid', () => {
  it('renders 7 day headers (Mon–Sun)', () => {
    render(
      <WeekGrid
        referenceDate={MONDAY}
        events={[]}
        pendingEvents={[]}
      />
    )
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-header-${i}`)).toBeInTheDocument()
    }
  })

  it('renders 7 day columns', () => {
    render(
      <WeekGrid referenceDate={MONDAY} events={[]} pendingEvents={[]} />
    )
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-column-${i}`)).toBeInTheDocument()
    }
  })

  it('places event in correct day column', () => {
    const event = makeEvent(2, 10) // Wednesday
    render(
      <WeekGrid referenceDate={MONDAY} events={[event]} pendingEvents={[]} />
    )
    expect(screen.getByTestId('event-block-evt-d2-h10')).toBeInTheDocument()
  })

  it('places all-day event (date string) in correct day column', () => {
    // Friday = dayOffset 4 from Monday April 6
    const friday: CalendarEvent = {
      id: 'evt-allday-fri',
      summary: 'All-day Friday event',
      start: { date: '2026-04-10' }, // Friday, no time
      end: { date: '2026-04-11' },
    }
    render(
      <WeekGrid referenceDate={MONDAY} events={[friday]} pendingEvents={[]} />
    )
    // Should appear in day column 4 (Friday), not column 2 (Wednesday) or 3 (Thursday)
    const fridayColumn = screen.getByTestId('day-column-4')
    expect(fridayColumn.querySelector('[data-testid="event-block-evt-allday-fri"]')).toBeInTheDocument()
  })

  it('renders ghost block for pending events with dashed style', () => {
    const pending = makePending(0) // Monday
    render(
      <WeekGrid referenceDate={MONDAY} events={[]} pendingEvents={[pending]} />
    )
    const ghost = screen.getByTestId('ghost-block-pending-d0')
    expect(ghost).toBeInTheDocument()
    // The inner div should have dashed border class
    expect(ghost.querySelector('.border-dashed')).toBeInTheDocument()
  })

  it('calls onEventClick when event is clicked', () => {
    const onClick = vi.fn()
    const event = makeEvent(0, 9)
    render(
      <WeekGrid
        referenceDate={MONDAY}
        events={[event]}
        pendingEvents={[]}
        onEventClick={onClick}
      />
    )
    fireEvent.click(screen.getByTestId('event-block-evt-d0-h9'))
    expect(onClick).toHaveBeenCalledWith(event)
  })

  it('calls onPendingClick when ghost block is clicked', () => {
    const onClick = vi.fn()
    const pending = makePending(1)
    render(
      <WeekGrid
        referenceDate={MONDAY}
        events={[]}
        pendingEvents={[pending]}
        onPendingClick={onClick}
      />
    )
    fireEvent.click(screen.getByTestId('ghost-block-pending-d1'))
    expect(onClick).toHaveBeenCalledWith(pending)
  })
})
