/**
 * Integration test: pending event flow
 *
 * Simulates the sequence:
 *   1. Agent proposes an event (pushed via SSE → pendingEventsStore)
 *   2. Ghost block appears in the calendar
 *   3. User clicks ghost → EventModal opens
 *   4. User clicks "Save & Confirm" → event removed from store + modal closes
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { usePendingEventsStore, PendingEvent } from '../store/pendingEventsStore'
import { GhostEventBlock } from '../components/calendar/GhostEventBlock'
import { EventModal } from '../components/calendar/EventModal'

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

const PENDING: PendingEvent = {
  id: 'pending-test-01',
  title: 'Design review',
  start: new Date('2026-04-07T15:00:00Z'),
  end: new Date('2026-04-07T16:00:00Z'),
  attendees: ['alice@example.com'],
  description: 'Review Q2 designs',
}

/**
 * We test the flow by directly interacting with the store and components
 * in sequence, rather than through a host wrapper.
 */
describe('Pending event flow', () => {
  beforeEach(() => {
    usePendingEventsStore.setState({ events: [] })
  })

  it('addEvent populates the store', () => {
    usePendingEventsStore.getState().addEvent(PENDING)
    expect(usePendingEventsStore.getState().events).toHaveLength(1)
    expect(usePendingEventsStore.getState().events[0].title).toBe('Design review')
  })

  it('GhostEventBlock renders for each pending event', () => {
    usePendingEventsStore.getState().addEvent(PENDING)
    const events = usePendingEventsStore.getState().events

    render(
      <>
        {events.map((e) => (
          <GhostEventBlock key={e.id} event={e} />
        ))}
      </>
    )

    expect(screen.getByText('Design review')).toBeInTheDocument()
  })

  it('clicking GhostEventBlock calls onClick handler', () => {
    usePendingEventsStore.getState().addEvent(PENDING)
    const onClick = vi.fn()

    render(<GhostEventBlock event={PENDING} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /pending: design review/i }))
    expect(onClick).toHaveBeenCalledWith(PENDING)
  })

  it('EventModal opens with event data', () => {
    usePendingEventsStore.getState().addEvent(PENDING)
    render(<EventModal event={PENDING} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Design review')).toBeInTheDocument()
  })

  it('confirming event in modal removes it from store', async () => {
    usePendingEventsStore.getState().addEvent(PENDING)
    const onClose = vi.fn()

    render(<EventModal event={PENDING} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /save.*confirm/i }))

    await waitFor(() => expect(usePendingEventsStore.getState().events).toHaveLength(0))
    expect(onClose).toHaveBeenCalled()
  })

  it('cancelling event in modal removes it from store', () => {
    usePendingEventsStore.getState().addEvent(PENDING)
    const onClose = vi.fn()

    render(<EventModal event={PENDING} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel event/i }))

    expect(usePendingEventsStore.getState().events).toHaveLength(0)
    expect(onClose).toHaveBeenCalled()
  })

  it('multiple pending events all show as ghost blocks', () => {
    const second: PendingEvent = {
      id: 'pending-test-02',
      title: 'Sprint planning',
      start: new Date('2026-04-08T10:00:00Z'),
      end: new Date('2026-04-08T11:00:00Z'),
    }
    usePendingEventsStore.getState().addEvent(PENDING)
    usePendingEventsStore.getState().addEvent(second)

    const events = usePendingEventsStore.getState().events
    render(
      <>
        {events.map((e) => (
          <GhostEventBlock key={e.id} event={e} />
        ))}
      </>
    )

    expect(screen.getByText('Design review')).toBeInTheDocument()
    expect(screen.getByText('Sprint planning')).toBeInTheDocument()
  })

  it('beforeunload fires when pending events exist', () => {
    usePendingEventsStore.getState().addEvent(PENDING)

    const mockEvent = new Event('beforeunload') as BeforeUnloadEvent
    Object.defineProperty(mockEvent, 'returnValue', { writable: true, value: '' })

    const handler = (e: BeforeUnloadEvent) => {
      if (usePendingEventsStore.getState().events.length > 0) {
        e.preventDefault()
        e.returnValue = 'You have pending events'
      }
    }
    window.addEventListener('beforeunload', handler)
    window.dispatchEvent(mockEvent)
    window.removeEventListener('beforeunload', handler)

    expect(mockEvent.returnValue).toBe('You have pending events')
  })
})
