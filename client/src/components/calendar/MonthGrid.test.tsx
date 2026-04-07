import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MonthGrid } from './MonthGrid'
import type { CalendarEvent } from '../../api/calendar'
import type { PendingEvent } from '../../store/pendingEventsStore'

const APRIL_2026 = new Date(2026, 3, 1) // April 2026

function makeEvent(day: number): CalendarEvent {
  const start = new Date(2026, 3, day, 10, 0)
  const end = new Date(2026, 3, day, 11, 0)
  return {
    id: `evt-apr${day}`,
    summary: `April ${day} meeting`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}

function makePending(day: number): PendingEvent {
  const start = new Date(2026, 3, day, 14, 0)
  const end = new Date(2026, 3, day, 15, 0)
  return { id: `pending-apr${day}`, title: 'Pending mtg', start, end }
}

describe('MonthGrid', () => {
  it('renders at least 4 week rows', () => {
    render(<MonthGrid referenceDate={APRIL_2026} events={[]} pendingEvents={[]} />)
    expect(screen.getByTestId('week-row-0')).toBeInTheDocument()
    expect(screen.getByTestId('week-row-3')).toBeInTheDocument()
  })

  it('renders event bar for events on correct day', () => {
    const event = makeEvent(7)
    render(<MonthGrid referenceDate={APRIL_2026} events={[event]} pendingEvents={[]} />)
    expect(screen.getByTestId('month-event-bar-evt-apr7')).toBeInTheDocument()
  })

  it('renders ghost bar differently from real event bars', () => {
    const pending = makePending(7)
    render(
      <MonthGrid referenceDate={APRIL_2026} events={[]} pendingEvents={[pending]} />
    )
    const ghostBar = screen.getByTestId('month-ghost-bar-pending-apr7')
    expect(ghostBar).toBeInTheDocument()
    // Ghost should have dashed border class, real events should not
    expect(ghostBar.className).toContain('border-dashed')
  })

  it('calls onEventClick when an event bar is clicked', () => {
    const onClick = vi.fn()
    const event = makeEvent(10)
    render(
      <MonthGrid referenceDate={APRIL_2026} events={[event]} pendingEvents={[]} onEventClick={onClick} />
    )
    fireEvent.click(screen.getByTestId('month-event-bar-evt-apr10'))
    expect(onClick).toHaveBeenCalledWith(event)
  })

  it('calls onPendingClick when ghost bar is clicked', () => {
    const onClick = vi.fn()
    const pending = makePending(15)
    render(
      <MonthGrid referenceDate={APRIL_2026} events={[]} pendingEvents={[pending]} onPendingClick={onClick} />
    )
    fireEvent.click(screen.getByTestId('month-ghost-bar-pending-apr15'))
    expect(onClick).toHaveBeenCalledWith(pending)
  })
})
