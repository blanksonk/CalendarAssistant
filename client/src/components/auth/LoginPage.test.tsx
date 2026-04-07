import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './LoginPage'

// Mock useAuth so we don't need a real API
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../hooks/useAuth'

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('LoginPage', () => {
  const mockLogin = vi.fn()

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: vi.fn(),
    })
  })

  it('renders the sign-in button', () => {
    renderWithQuery(<LoginPage />)
    expect(screen.getByTestId('google-signin-btn')).toBeInTheDocument()
  })

  it('displays the app name', () => {
    renderWithQuery(<LoginPage />)
    expect(screen.getByText('CalendarAssistant')).toBeInTheDocument()
  })

  it('calls login when sign-in button is clicked', () => {
    renderWithQuery(<LoginPage />)
    fireEvent.click(screen.getByTestId('google-signin-btn'))
    expect(mockLogin).toHaveBeenCalledOnce()
  })

  it('shows the Google scope disclaimer', () => {
    renderWithQuery(<LoginPage />)
    expect(screen.getByText(/Google Calendar/i)).toBeInTheDocument()
  })
})
