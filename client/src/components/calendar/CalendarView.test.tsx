import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarView } from './CalendarView'

vi.mock('../../hooks/useCalendar', () => ({
  useCalendar: vi.fn(),
}))

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

  it('renders time range toggle (Week / Month) in calendar display mode', () => {
    renderView()
    // Time toggle is hidden in radial mode — switch to calendar first
    fireEvent.click(screen.getByTestId('display-toggle-calendar'))
    expect(screen.getByTestId('time-toggle-week')).toBeInTheDocument()
    expect(screen.getByTestId('time-toggle-month')).toBeInTheDocument()
  })

  it('hides time range toggle in radial mode', () => {
    renderView()
    expect(screen.queryByTestId('time-toggle-week')).not.toBeInTheDocument()
    expect(screen.queryByTestId('time-toggle-month')).not.toBeInTheDocument()
  })

  it('renders display mode toggle (Calendar / Radial)', () => {
    renderView()
    expect(screen.getByTestId('display-toggle-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('display-toggle-radial')).toBeInTheDocument()
  })

  it('shows radial view by default', () => {
    renderView()
    expect(screen.getByTestId('radial-view')).toBeInTheDocument()
  })

  it('switches to calendar grid when Calendar toggle is clicked', () => {
    renderView()
    fireEvent.click(screen.getByTestId('display-toggle-calendar'))
    // timeRange stays 'week' (radial mode doesn't change user's preference)
    expect(screen.getByTestId('week-grid')).toBeInTheDocument()
    expect(screen.queryByTestId('radial-view')).not.toBeInTheDocument()
  })

  it('switches to month grid when Month + Calendar is selected', () => {
    renderView()
    fireEvent.click(screen.getByTestId('display-toggle-calendar'))
    fireEvent.click(screen.getByTestId('time-toggle-month'))
    expect(screen.getByTestId('month-grid')).toBeInTheDocument()
  })

  it('renders stats bar', () => {
    renderView()
    expect(screen.getByTestId('stats-bar')).toBeInTheDocument()
  })

  it('ghost event from pending store appears in calendar view', () => {
    const pending = {
      id: 'p1',
      title: 'Proposed meeting',
      start: new Date(2026, 3, 6, 14, 0),
      end: new Date(2026, 3, 6, 15, 0),
    }
    vi.mocked(usePendingEventsStore).mockReturnValue([pending])
    renderView()
    // Switch to calendar grid to see ghost block
    fireEvent.click(screen.getByTestId('display-toggle-calendar'))
    expect(screen.getByTestId('ghost-block-p1')).toBeInTheDocument()
  })
})
