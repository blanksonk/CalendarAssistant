import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ChatPanel } from './ChatPanel'
import { usePendingEventsStore } from '../../store/pendingEventsStore'

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Alice Smith', email: 'alice@example.com' } }),
}))

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  usePendingEventsStore.setState({ events: [] })
})

describe('ChatPanel', () => {
  it('renders header', () => {
    render(<ChatPanel />)
    expect(screen.getByText('Assistant')).toBeInTheDocument()
  })

  it('shows proactive greeting with user first name', async () => {
    render(<ChatPanel />)
    await waitFor(() => {
      expect(screen.getByText(/alice/i)).toBeInTheDocument()
    })
  })

  it('renders chat input', () => {
    render(<ChatPanel />)
    expect(screen.getByRole('textbox', { name: /chat message/i })).toBeInTheDocument()
  })

  it('shows @ mention hint in header', () => {
    render(<ChatPanel />)
    expect(screen.getByText(/@ to mention/i)).toBeInTheDocument()
  })

  it('sends message and renders streamed text', async () => {
    // Mock fetch to return a simple SSE stream
    const sseBody = [
      'data: {"type":"text","delta":"You have 13 meetings this week."}\n\n',
      'data: {"type":"done"}\n\n',
    ].join('')

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody))
        controller.close()
      },
    })

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'X-Chat-Session-Id': 'mock-session',
        },
      })
    )

    render(<ChatPanel />)
    const input = screen.getByRole('textbox', { name: /chat message/i })

    await act(async () => {
      fireEvent.change(input, { target: { value: 'What is my schedule?' } })
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    })

    await waitFor(() => {
      expect(screen.getByText('What is my schedule?')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/13 meetings/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
