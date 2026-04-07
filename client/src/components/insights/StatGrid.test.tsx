import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatGrid } from './StatGrid'
import type { AtAGlance, MeetingQuality, TimeBreakdown } from '../../api/insights'

const mockAtAGlance: AtAGlance = {
  total_meetings: 13,
  new_meetings: 5,
  avg_duration_mins: 45,
  longest_meeting_mins: 90,
  busiest_day: 'Tuesday',
}

const mockTimeBreakdown: TimeBreakdown = {
  total_meeting_mins: 585,
  focus_block_count: 2,
  back_to_back_count: 1,
  morning_meetings: 8,
  afternoon_meetings: 5,
}

const mockMeetingQuality: MeetingQuality = {
  no_agenda_count: 3,
  recurring_count: 7,
  one_off_count: 6,
  organized_count: 4,
  invited_count: 9,
  one_on_one_count: 5,
  group_count: 8,
}

describe('StatGrid', () => {
  it('renders total meetings', () => {
    render(
      <StatGrid
        atAGlance={mockAtAGlance}
        timeBreakdown={mockTimeBreakdown}
        meetingQuality={mockMeetingQuality}
      />
    )
    expect(screen.getByText('13')).toBeInTheDocument()
  })

  it('renders busiest day', () => {
    render(
      <StatGrid
        atAGlance={mockAtAGlance}
        timeBreakdown={mockTimeBreakdown}
        meetingQuality={mockMeetingQuality}
      />
    )
    expect(screen.getByText('Tuesday')).toBeInTheDocument()
  })

  it('formats minutes into hours+mins', () => {
    render(
      <StatGrid
        atAGlance={mockAtAGlance}
        timeBreakdown={mockTimeBreakdown}
        meetingQuality={mockMeetingQuality}
      />
    )
    // 585 mins = 9h 45m
    expect(screen.getByText('9h 45m')).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading=true', () => {
    const { container } = render(
      <StatGrid
        atAGlance={mockAtAGlance}
        timeBreakdown={mockTimeBreakdown}
        meetingQuality={mockMeetingQuality}
        isLoading
      />
    )
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('renders all section headings', () => {
    render(
      <StatGrid
        atAGlance={mockAtAGlance}
        timeBreakdown={mockTimeBreakdown}
        meetingQuality={mockMeetingQuality}
      />
    )
    expect(screen.getByText(/at a glance/i)).toBeInTheDocument()
    expect(screen.getByText(/time breakdown/i)).toBeInTheDocument()
    expect(screen.getByText(/meeting quality/i)).toBeInTheDocument()
  })

  it('highlights focus blocks when count > 0', () => {
    render(
      <StatGrid
        atAGlance={mockAtAGlance}
        timeBreakdown={mockTimeBreakdown}
        meetingQuality={mockMeetingQuality}
      />
    )
    // Focus block card should have highlight styling (bg-blue-50)
    const focusCard = screen.getByRole('group', { name: /focus blocks/i })
    expect(focusCard.className).toContain('bg-blue-50')
  })
})
