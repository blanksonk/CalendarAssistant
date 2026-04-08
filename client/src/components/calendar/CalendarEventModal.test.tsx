import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarEventModal } from './CalendarEventModal'
import type { CalendarEvent } from '../../api/calendar'

vi.mock('../../api/calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/calendar')>()
  return { ...actual, updateEvent: vi.fn() }
})

import { updateEvent } from '../../api/calendar'

const MOCK_EVENT: CalendarEvent = {
  id: 'evt-1',
  summary: 'Team sync',
  description: 'Weekly sync',
  start: { dateTime: new Date(2026, 3, 7, 10, 0).toISOString() },
  end: { dateTime: new Date(2026, 3, 7, 11, 0).toISOString() },
  attendees: [
    { email: 'alice@example.com', self: false },
    { email: 'me@example.com', self: true },
  ],
}

function renderModal(event: CalendarEvent | null, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CalendarEventModal event={event} onClose={onClose} />
    </QueryClientProvider>
  )
}

describe('CalendarEventModal', () => {
  beforeEach(() => {
    vi.mocked(updateEvent).mockResolvedValue({ ...MOCK_EVENT, summary: 'Updated' })
  })

  it('renders nothing when event is null', () => {
    renderModal(null)
    expect(screen.queryByTestId('calendar-event-modal')).not.toBeInTheDocument()
  })

  it('renders modal with event fields pre-filled', () => {
    renderModal(MOCK_EVENT)
    expect(screen.getByTestId('modal-title-input')).toHaveValue('Team sync')
    expect(screen.getByTestId('modal-description-input')).toHaveValue('Weekly sync')
  })

  it('excludes self from attendees list', () => {
    renderModal(MOCK_EVENT)
    const attendeesInput = screen.getByTestId('modal-attendees-input')
    expect(attendeesInput).toHaveValue('alice@example.com')
    expect((attendeesInput as HTMLInputElement).value).not.toContain('me@example.com')
  })

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn()
    renderModal(MOCK_EVENT, onClose)
    fireEvent.click(screen.getByTestId('modal-cancel-btn'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    renderModal(MOCK_EVENT, onClose)
    fireEvent.click(screen.getByTestId('modal-close-btn'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    renderModal(MOCK_EVENT, onClose)
    fireEvent.click(screen.getByTestId('calendar-event-modal-overlay'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls updateEvent with edited values on save', async () => {
    const onClose = vi.fn()
    renderModal(MOCK_EVENT, onClose)

    fireEvent.change(screen.getByTestId('modal-title-input'), {
      target: { value: 'Renamed sync' },
    })
    fireEvent.click(screen.getByTestId('modal-save-btn'))

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'evt-1',
        expect.objectContaining({ title: 'Renamed sync' })
      )
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows error message when save fails', async () => {
    vi.mocked(updateEvent).mockRejectedValue(new Error('Network error'))
    renderModal(MOCK_EVENT)

    fireEvent.click(screen.getByTestId('modal-save-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('modal-error')).toBeInTheDocument()
    })
  })

  it('disables save button while saving', async () => {
    vi.mocked(updateEvent).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(MOCK_EVENT), 100))
    )
    renderModal(MOCK_EVENT)
    fireEvent.click(screen.getByTestId('modal-save-btn'))
    expect(screen.getByTestId('modal-save-btn')).toBeDisabled()
  })
})
