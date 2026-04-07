import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventProposalCard, ProposedEvent } from './EventProposalCard'
import { usePendingEventsStore } from '../../store/pendingEventsStore'

const mockEvent: ProposedEvent = {
  id: 'pending-001',
  title: 'Team sync',
  start: '2026-04-07T14:00:00Z',
  end: '2026-04-07T15:00:00Z',
  attendees: ['alice@example.com', 'bob@example.com'],
  description: 'Weekly sync meeting',
}

beforeEach(() => {
  usePendingEventsStore.setState({ events: [] })
})

describe('EventProposalCard', () => {
  it('renders event title', () => {
    render(<EventProposalCard event={mockEvent} />)
    expect(screen.getByText('Team sync')).toBeInTheDocument()
  })

  it('renders attendees', () => {
    render(<EventProposalCard event={mockEvent} />)
    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<EventProposalCard event={mockEvent} />)
    expect(screen.getByText('Weekly sync meeting')).toBeInTheDocument()
  })

  it('shows Proposed badge', () => {
    render(<EventProposalCard event={mockEvent} />)
    expect(screen.getByText('Proposed')).toBeInTheDocument()
  })

  it('adds event to store on confirm', () => {
    render(<EventProposalCard event={mockEvent} />)
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    const events = usePendingEventsStore.getState().events
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Team sync')
  })

  it('calls onRevise with prefilled text', () => {
    const onRevise = vi.fn()
    render(<EventProposalCard event={mockEvent} onRevise={onRevise} />)
    fireEvent.click(screen.getByRole('button', { name: /revise/i }))
    expect(onRevise).toHaveBeenCalledWith(expect.stringContaining('Team sync'))
  })

  it('has article role', () => {
    render(<EventProposalCard event={mockEvent} />)
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('omits attendees section when empty', () => {
    const ev = { ...mockEvent, attendees: [] }
    render(<EventProposalCard event={ev} />)
    expect(screen.queryByText(/With:/)).not.toBeInTheDocument()
  })
})
