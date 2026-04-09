import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventModal } from './EventModal'
import { PendingEvent, usePendingEventsStore } from '../../store/pendingEventsStore'

const mockEvent: PendingEvent = {
  id: 'pending-001',
  title: 'Team sync',
  start: new Date('2026-04-07T14:00:00Z'),
  end: new Date('2026-04-07T15:00:00Z'),
  attendees: ['alice@example.com'],
  description: 'Weekly sync',
}

beforeEach(() => {
  usePendingEventsStore.setState({ events: [mockEvent] })
})

describe('EventModal', () => {
  it('renders null when event is null', () => {
    const { container } = render(<EventModal event={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders dialog with event title', () => {
    render(<EventModal event={mockEvent} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Team sync')).toBeInTheDocument()
  })

  it('shows pre-filled attendees as chips', () => {
    render(<EventModal event={mockEvent} onClose={vi.fn()} />)
    // Attendees are rendered as chips (spans), not a text input
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('removes attendee chip on × click', () => {
    render(<EventModal event={mockEvent} onClose={vi.fn()} />)
    const removeBtn = screen.getByRole('button', { name: /remove alice/i })
    fireEvent.mouseDown(removeBtn)
    expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<EventModal event={mockEvent} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<EventModal event={mockEvent} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('Save & Confirm removes event from store and calls onClose', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<EventModal event={mockEvent} onClose={onClose} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: /save.*confirm/i }))
    await waitFor(() => expect(usePendingEventsStore.getState().events).toHaveLength(0))
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).toHaveBeenCalled()
  })

  it('Cancel removes event from store', () => {
    const onClose = vi.fn()
    render(<EventModal event={mockEvent} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel event/i }))
    expect(usePendingEventsStore.getState().events).toHaveLength(0)
    expect(onClose).toHaveBeenCalled()
  })

  it('Ask calls onRevise with typed text', () => {
    const onRevise = vi.fn()
    const onClose = vi.fn()
    render(<EventModal event={mockEvent} onClose={onClose} onRevise={onRevise} />)
    fireEvent.change(screen.getByLabelText(/ask agent/i), {
      target: { value: 'Make it 30 mins shorter' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))
    expect(onRevise).toHaveBeenCalledWith('Make it 30 mins shorter')
    expect(onClose).toHaveBeenCalled()
  })

  it('Ask with empty input uses default message', () => {
    const onRevise = vi.fn()
    render(<EventModal event={mockEvent} onClose={vi.fn()} onRevise={onRevise} />)
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))
    expect(onRevise).toHaveBeenCalledWith(expect.stringContaining('Team sync'))
  })
})
