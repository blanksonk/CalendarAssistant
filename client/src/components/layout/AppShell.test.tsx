import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './AppShell'

function renderAppShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  )
}

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../store/pendingEventsStore', () => ({
  usePendingEventsStore: vi.fn(() => []),
}))

// Stub heavy child components to keep tests focused on AppShell behaviour
vi.mock('../calendar/CalendarView', () => ({
  CalendarView: ({ onEventClick }: { onEventClick?: (e: any) => void }) => (
    <div data-testid="calendar-view">
      <button
        data-testid="trigger-event-click"
        onClick={() => onEventClick?.({ id: 'e1', summary: 'Test Event', start: { dateTime: new Date().toISOString() }, end: { dateTime: new Date().toISOString() } })}
      >
        Click event
      </button>
    </div>
  ),
}))

vi.mock('../calendar/CalendarEventModal', () => ({
  CalendarEventModal: ({ event, onClose }: { event: any; onClose: () => void }) =>
    event ? (
      <div data-testid="calendar-event-modal">
        <span>{event.summary}</span>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

vi.mock('../insights/InsightsPanel', () => ({
  InsightsPanel: ({ onPromptAgent }: { onPromptAgent: (m: string) => void }) => (
    <div data-testid="insights-panel">
      <button data-testid="prompt-agent-btn" onClick={() => onPromptAgent('hello')}>
        Prompt
      </button>
    </div>
  ),
}))

vi.mock('../chat/ChatPanel', () => ({
  ChatPanel: ({
    onTabSwitch,
    initialInput,
  }: {
    onTabSwitch?: (tab: 'calendar' | 'insights') => void
    initialInput?: string
  }) => (
    <div data-testid="chat-panel">
      <button data-testid="agent-switch-insights" onClick={() => onTabSwitch?.('insights')}>
        Switch to Insights
      </button>
      <button data-testid="agent-switch-calendar" onClick={() => onTabSwitch?.('calendar')}>
        Switch to Calendar
      </button>
      {initialInput && <span data-testid="initial-input">{initialInput}</span>}
    </div>
  ),
}))

import { useAuth } from '../../hooks/useAuth'
import { usePendingEventsStore } from '../../store/pendingEventsStore'

const MOCK_USER = { id: 'u1', email: 'test@example.com', name: 'Test User', picture: null }

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: MOCK_USER,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  })
  vi.mocked(usePendingEventsStore).mockReturnValue([])
})

describe('AppShell', () => {
  it('renders calendar view by default', () => {
    renderAppShell()
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
    expect(screen.queryByTestId('insights-panel')).not.toBeInTheDocument()
  })

  it('renders chat panel at all times', () => {
    renderAppShell()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('shows user email in header', () => {
    renderAppShell()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('switches to insights panel when Insights tab is clicked', () => {
    renderAppShell()
    fireEvent.click(screen.getByTestId('main-tab-insights'))
    expect(screen.getByTestId('insights-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-view')).not.toBeInTheDocument()
  })

  it('switches back to calendar when Calendar tab is clicked', () => {
    renderAppShell()
    fireEvent.click(screen.getByTestId('main-tab-insights'))
    fireEvent.click(screen.getByTestId('main-tab-calendar'))
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
    expect(screen.queryByTestId('insights-panel')).not.toBeInTheDocument()
  })

  it('agent switch_tab event switches active tab to insights', () => {
    renderAppShell()
    fireEvent.click(screen.getByTestId('agent-switch-insights'))
    expect(screen.getByTestId('insights-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar-view')).not.toBeInTheDocument()
  })

  it('agent switch_tab event switches active tab back to calendar', () => {
    renderAppShell()
    fireEvent.click(screen.getByTestId('agent-switch-insights'))
    fireEvent.click(screen.getByTestId('agent-switch-calendar'))
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
  })

  it('shows pending events badge when pending events exist', () => {
    vi.mocked(usePendingEventsStore).mockReturnValue([
      { id: 'p1', title: 'Pending', start: new Date(), end: new Date() },
    ] as any)
    renderAppShell()
    expect(screen.getByText('1 pending')).toBeInTheDocument()
  })

  it('prompting agent from InsightsPanel pre-fills chat input', () => {
    renderAppShell()
    fireEvent.click(screen.getByTestId('main-tab-insights'))
    fireEvent.click(screen.getByTestId('prompt-agent-btn'))
    expect(screen.getByTestId('initial-input')).toHaveTextContent('hello')
  })

  it('opens event modal when an event is clicked in CalendarView', () => {
    renderAppShell()
    fireEvent.click(screen.getByTestId('trigger-event-click'))
    expect(screen.getByTestId('calendar-event-modal')).toBeInTheDocument()
    expect(screen.getByText('Test Event')).toBeInTheDocument()
  })

  it('closes event modal when modal requests close', () => {
    renderAppShell()
    fireEvent.click(screen.getByTestId('trigger-event-click'))
    fireEvent.click(screen.getByTestId('modal-close'))
    expect(screen.queryByTestId('calendar-event-modal')).not.toBeInTheDocument()
  })
})
