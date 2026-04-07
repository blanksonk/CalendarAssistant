import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GhostEventBlock } from './GhostEventBlock'
import { PendingEvent, usePendingEventsStore } from '../../store/pendingEventsStore'

const mockEvent: PendingEvent = {
  id: 'pending-001',
  title: 'Team sync',
  start: new Date('2026-04-07T14:00:00Z'),
  end: new Date('2026-04-07T15:00:00Z'),
  attendees: ['alice@example.com', 'bob@example.com'],
}

describe('GhostEventBlock', () => {
  describe('week variant (default)', () => {
    it('renders event title', () => {
      render(<GhostEventBlock event={mockEvent} />)
      expect(screen.getByText('Team sync')).toBeInTheDocument()
    })

    it('has role=button and aria-label', () => {
      render(<GhostEventBlock event={mockEvent} />)
      expect(screen.getByRole('button', { name: /pending: team sync/i })).toBeInTheDocument()
    })

    it('renders start/end times', () => {
      render(<GhostEventBlock event={mockEvent} />)
      const el = screen.getByTestId('ghost-week-pending-001')
      expect(el.textContent).toMatch(/–/)
    })

    it('calls onClick when clicked', () => {
      const onClick = vi.fn()
      render(<GhostEventBlock event={mockEvent} onClick={onClick} />)
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledWith(mockEvent)
    })

    it('shows truncated attendees', () => {
      render(<GhostEventBlock event={mockEvent} />)
      expect(screen.getByText(/alice@example.com/)).toBeInTheDocument()
    })
  })

  describe('month variant', () => {
    it('renders with month testid', () => {
      render(<GhostEventBlock event={mockEvent} variant="month" />)
      expect(screen.getByTestId('ghost-month-pending-001')).toBeInTheDocument()
    })

    it('shows title', () => {
      render(<GhostEventBlock event={mockEvent} variant="month" />)
      expect(screen.getByText('Team sync')).toBeInTheDocument()
    })
  })

  describe('radial variant', () => {
    it('renders with radial testid', () => {
      render(<GhostEventBlock event={mockEvent} variant="radial" />)
      expect(screen.getByTestId('ghost-radial-pending-001')).toBeInTheDocument()
    })

    it('has animate-pulse class', () => {
      render(<GhostEventBlock event={mockEvent} variant="radial" />)
      expect(screen.getByTestId('ghost-radial-pending-001')).toHaveClass('animate-pulse')
    })
  })
})

describe('usePendingEventsStore', () => {

  beforeEach(() => {
    usePendingEventsStore.setState({ events: [] })
  })

  it('starts empty', () => {
    expect(usePendingEventsStore.getState().events).toHaveLength(0)
  })

  it('addEvent adds to store', () => {
    usePendingEventsStore.getState().addEvent(mockEvent)
    expect(usePendingEventsStore.getState().events).toHaveLength(1)
  })

  it('removeEvent removes by id', () => {
    usePendingEventsStore.getState().addEvent(mockEvent)
    usePendingEventsStore.getState().removeEvent('pending-001')
    expect(usePendingEventsStore.getState().events).toHaveLength(0)
  })

  it('updateEvent patches fields', () => {
    usePendingEventsStore.getState().addEvent(mockEvent)
    usePendingEventsStore.getState().updateEvent('pending-001', { title: 'Updated' })
    expect(usePendingEventsStore.getState().events[0].title).toBe('Updated')
  })

  it('clear empties the store', () => {
    usePendingEventsStore.getState().addEvent(mockEvent)
    usePendingEventsStore.getState().clear()
    expect(usePendingEventsStore.getState().events).toHaveLength(0)
  })
})
