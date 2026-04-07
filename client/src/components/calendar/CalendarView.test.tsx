import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarView } from './CalendarView'

// Mock useCalendar to avoid real fetch calls
vi.mock('../../hooks/useCalendar', () => ({
  useCalendar: vi.fn(),
}))

// Mock the pending events store
vi.mock('../../store/pendingEventsStore', () => ({
  usePendingEventsStore: vi.fn(() => []),
}))

import { useCalendar } from '../../hooks/useCalendar'
import { usePendingEventsStore } from '../../store/pendingEventsStore'

function makeEvent(id: string): any {
  return {
    id,
    summary: 'Test event',
    start: { dateTime: new Date(2026, 3, 7, 10, 0).toISOString() },
    end: { dateTime: new Date(2026, 3, 7, 11, 0).toISOString() },
  }
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CalendarView />
    </QueryClientProvider>
  )
}

describe('CalendarView', () => {
  beforeEach(() => {
    vi.mocked(useCalendar).mockReturnValue({
      events: [makeEvent('e1')],
      isLoading: false,
      start: new Date(2026, 3, 6),
      end: new Date(2026, 3, 13),
    })
    vi.mocked(usePendingEventsStore).mockReturnValue([])
  })

  it('renders three tab buttons', () => {
    renderView()
    expect(screen.getByTestId('tab-week')).toBeInTheDocument()
    expect(screen.getByTestId('tab-month')).toBeInTheDocument()
    expect(screen.getByTestId('tab-radial')).toBeInTheDocument()
  })

  it('shows week grid by default', () => {
    renderView()
    expect(screen.getByTestId('week-grid')).toBeInTheDocument()
  })

  it('switches to month view when month tab is clicked', () => {
    renderView()
    fireEvent.click(screen.getByTestId('tab-month'))
    expect(screen.getByTestId('month-grid')).toBeInTheDocument()
    expect(screen.queryByTestId('week-grid')).not.toBeInTheDocument()
  })

  it('switches to radial view when radial tab is clicked', () => {
    renderView()
    fireEvent.click(screen.getByTestId('tab-radial'))
    expect(screen.getByTestId('radial-view')).toBeInTheDocument()
  })

  it('renders stats bar', () => {
    renderView()
    expect(screen.getByTestId('stats-bar')).toBeInTheDocument()
  })

  it('ghost event from pending store appears in week view', () => {
    const pending = {
      id: 'p1',
      title: 'Proposed meeting',
      start: new Date(2026, 3, 6, 14, 0), // Monday
      end: new Date(2026, 3, 6, 15, 0),
    }
    vi.mocked(usePendingEventsStore).mockReturnValue([pending])

    renderView()
    expect(screen.getByTestId('ghost-block-p1')).toBeInTheDocument()
  })
})
