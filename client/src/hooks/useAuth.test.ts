import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useAuth } from './useAuth'

// Mock the auth API module
vi.mock('../api/auth', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  getGoogleLoginUrl: vi.fn(() => '/api/auth/google'),
}))

import { fetchMe, logout as apiLogout } from '../api/auth'

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.location mock
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
  })

  it('returns null user when not authenticated', async () => {
    vi.mocked(fetchMe).mockResolvedValue(null)

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('returns user when authenticated', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      id: 'abc-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: null,
    })

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user?.email).toBe('test@example.com')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('login redirects to google login URL', async () => {
    vi.mocked(fetchMe).mockResolvedValue(null)

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    result.current.login()
    expect(window.location.href).toBe('/api/auth/google')
  })

  it('logout calls API and clears user', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      id: 'abc-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: null,
    })
    vi.mocked(apiLogout).mockResolvedValue(undefined)

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    await result.current.logout()
    expect(apiLogout).toHaveBeenCalledOnce()
  })
})
