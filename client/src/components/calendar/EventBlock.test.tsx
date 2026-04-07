import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventBlock } from './EventBlock'
import type { CalendarEvent } from '../../api/calendar'

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    summary: 'Team sync',
    start: { dateTime: '2026-04-07T10:00:00Z' },
    end: { dateTime: '2026-04-07T11:00:00Z' },
    ...overrides,
  }
}

describe('EventBlock', () => {
  it('renders event title', () => {
    render(<EventBlock event={makeEvent()} />)
    expect(screen.getByText('Team sync')).toBeInTheDocument()
  })

  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    const event = makeEvent()
    render(<EventBlock event={event} onClick={onClick} />)
    fireEvent.click(screen.getByTestId('event-block-evt-1'))
    expect(onClick).toHaveBeenCalledWith(event)
  })

  it('applies blue class for 1:1 meetings (2 attendees)', () => {
    const event = makeEvent({
      attendees: [
        { email: 'me@example.com', self: true },
        { email: 'alice@example.com' },
      ],
    })
    render(<EventBlock event={event} />)
    const el = screen.getByTestId('event-block-evt-1')
    expect(el.className).toContain('bg-blue-100')
  })

  it('applies purple class for standup meetings', () => {
    const event = makeEvent({ summary: 'Daily Standup' })
    render(<EventBlock event={event} />)
    expect(screen.getByTestId('event-block-evt-1').className).toContain('bg-purple-100')
  })

  it('applies orange class for external meetings', () => {
    const event = makeEvent({ organizer: { email: 'external@other.com', self: false } })
    render(<EventBlock event={event} />)
    expect(screen.getByTestId('event-block-evt-1').className).toContain('bg-orange-100')
  })

  it('applies red class for large meetings (3+ attendees)', () => {
    const event = makeEvent({
      attendees: [
        { email: 'me@example.com', self: true },
        { email: 'alice@example.com' },
        { email: 'bob@example.com' },
      ],
    })
    render(<EventBlock event={event} />)
    expect(screen.getByTestId('event-block-evt-1').className).toContain('bg-red-100')
  })

  it('renders attendee avatars for non-self attendees', () => {
    const event = makeEvent({
      attendees: [
        { email: 'me@example.com', self: true },
        { email: 'alice@example.com', displayName: 'Alice' },
      ],
    })
    render(<EventBlock event={event} />)
    expect(screen.getByTestId('attendee-avatars')).toBeInTheDocument()
    expect(screen.getByTestId('avatar-alice@example.com')).toBeInTheDocument()
  })

  it('does not render avatars when no attendees', () => {
    render(<EventBlock event={makeEvent()} />)
    expect(screen.queryByTestId('attendee-avatars')).not.toBeInTheDocument()
  })
})
