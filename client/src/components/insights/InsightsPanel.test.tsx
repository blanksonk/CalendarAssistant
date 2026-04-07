import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InsightsPanel } from './InsightsPanel'
import type { InsightsData } from '../../api/insights'

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

const MOCK_DATA: InsightsData = {
  week_start: '2026-04-06',
  total_meetings: 13,
  at_a_glance: {
    total_meetings: 13,
    new_meetings: 5,
    avg_duration_mins: 45,
    longest_meeting_mins: 90,
    busiest_day: 'Tuesday',
  },
  time_breakdown: {
    total_meeting_mins: 585,
    focus_block_count: 2,
    back_to_back_count: 1,
    morning_meetings: 8,
    afternoon_meetings: 5,
  },
  meeting_quality: {
    no_agenda_count: 3,
    recurring_count: 7,
    one_off_count: 6,
    organized_count: 4,
    invited_count: 9,
    one_on_one_count: 5,
    group_count: 8,
  },
  top_people: [{ email: 'alice@example.com', count: 5 }],
  top_series: [{ title: 'Weekly standup', count: 5, total_mins: 150 }],
}

describe('InsightsPanel', () => {
  it('renders header and week toggle', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_DATA), { headers: { 'Content-Type': 'application/json' } })
    )
    render(<InsightsPanel />)
    expect(screen.getByText('Insights')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /this week/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /last week/i })).toBeInTheDocument()
  })

  it('shows busiest day after load', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_DATA), { headers: { 'Content-Type': 'application/json' } })
    )
    render(<InsightsPanel />)
    await waitFor(() => {
      expect(screen.getByText('Tuesday')).toBeInTheDocument()
    })
  })

  it('shows top person name', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_DATA), { headers: { 'Content-Type': 'application/json' } })
    )
    render(<InsightsPanel />)
    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })
  })

  it('shows top series title', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_DATA), { headers: { 'Content-Type': 'application/json' } })
    )
    render(<InsightsPanel />)
    await waitFor(() => {
      expect(screen.getByText('Weekly standup')).toBeInTheDocument()
    })
  })

  it('calls onPromptAgent when person clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_DATA), { headers: { 'Content-Type': 'application/json' } })
    )
    const onPromptAgent = vi.fn()
    render(<InsightsPanel onPromptAgent={onPromptAgent} />)

    await waitFor(() => screen.getByText('alice@example.com'))
    fireEvent.click(screen.getByRole('button', { name: /alice@example.com/i }))
    expect(onPromptAgent).toHaveBeenCalledWith(expect.stringContaining('alice@example.com'))
  })

  it('shows error state on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))
    render(<InsightsPanel />)
    await waitFor(() => {
      expect(screen.getByText(/failed to load insights/i)).toBeInTheDocument()
    })
  })

  it('switches to last week on toggle click', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_DATA), { headers: { 'Content-Type': 'application/json' } })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...MOCK_DATA, week_start: '2026-03-30' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    vi.stubGlobal('fetch', mockFetch)

    render(<InsightsPanel />)
    await waitFor(() => screen.getByText('Tuesday'))

    fireEvent.click(screen.getByRole('button', { name: /last week/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    vi.unstubAllGlobals()
  })
})
