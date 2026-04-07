import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatsBar } from './StatsBar'
import type { CalendarEvent } from '../../api/calendar'

function makeEvent(startHour: number, durationMins: number): CalendarEvent {
  const start = new Date(`2026-04-07T${String(startHour).padStart(2, '0')}:00:00Z`)
  const end = new Date(start.getTime() + durationMins * 60000)
  return {
    id: `evt-${startHour}`,
    summary: 'Meeting',
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}

describe('StatsBar', () => {
  const noop = vi.fn()

  it('renders meeting count', () => {
    const events = [makeEvent(9, 30), makeEvent(11, 60)]
    render(<StatsBar events={events} rangeLabel="Apr 7–13" onPrev={noop} onNext={noop} />)
    expect(screen.getByTestId('stat-meeting-count')).toHaveTextContent('2')
  })

  it('renders total meeting hours', () => {
    const events = [makeEvent(9, 60), makeEvent(11, 60)] // 2 hours
    render(<StatsBar events={events} rangeLabel="Apr 7–13" onPrev={noop} onNext={noop} />)
    expect(screen.getByTestId('stat-meeting-hrs')).toHaveTextContent('2')
  })

  it('renders 0 meetings when events list is empty', () => {
    render(<StatsBar events={[]} rangeLabel="Apr 7–13" onPrev={noop} onNext={noop} />)
    expect(screen.getByTestId('stat-meeting-count')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-efficiency')).toHaveTextContent('0%')
  })

  it('shows the range label', () => {
    render(<StatsBar events={[]} rangeLabel="Apr 7–13" onPrev={noop} onNext={noop} />)
    expect(screen.getByText('Apr 7–13')).toBeInTheDocument()
  })

  it('calls onPrev when prev button is clicked', () => {
    const onPrev = vi.fn()
    render(<StatsBar events={[]} rangeLabel="Apr 7–13" onPrev={onPrev} onNext={noop} />)
    fireEvent.click(screen.getByTestId('prev-btn'))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('calls onNext when next button is clicked', () => {
    const onNext = vi.fn()
    render(<StatsBar events={[]} rangeLabel="Apr 7–13" onPrev={noop} onNext={onNext} />)
    fireEvent.click(screen.getByTestId('next-btn'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('updates stats when props change', () => {
    const { rerender } = render(
      <StatsBar events={[makeEvent(9, 60)]} rangeLabel="Apr 7" onPrev={noop} onNext={noop} />
    )
    expect(screen.getByTestId('stat-meeting-count')).toHaveTextContent('1')

    rerender(
      <StatsBar
        events={[makeEvent(9, 60), makeEvent(11, 60), makeEvent(14, 60)]}
        rangeLabel="Apr 7"
        onPrev={noop}
        onNext={noop}
      />
    )
    expect(screen.getByTestId('stat-meeting-count')).toHaveTextContent('3')
  })
})
