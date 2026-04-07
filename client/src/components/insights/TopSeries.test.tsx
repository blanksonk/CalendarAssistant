import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopSeries } from './TopSeries'
import type { TopSeries as TopSeriesData } from '../../api/insights'

const seriesData: TopSeriesData[] = [
  { title: 'Weekly standup', count: 5, total_mins: 150 },
  { title: '1:1 with manager', count: 2, total_mins: 120 },
]

describe('TopSeries', () => {
  it('renders section heading', () => {
    render(<TopSeries series={seriesData} />)
    expect(screen.getByRole('region', { name: /top meeting series/i })).toBeInTheDocument()
  })

  it('renders series titles', () => {
    render(<TopSeries series={seriesData} />)
    expect(screen.getByText('Weekly standup')).toBeInTheDocument()
    expect(screen.getByText('1:1 with manager')).toBeInTheDocument()
  })

  it('formats total minutes', () => {
    render(<TopSeries series={seriesData} />)
    // 150 mins = 2h 30m
    expect(screen.getByText(/2h 30m total/)).toBeInTheDocument()
  })

  it('shows empty state when no series', () => {
    render(<TopSeries series={[]} />)
    expect(screen.getByText(/no recurring meetings/i)).toBeInTheDocument()
  })

  it('calls onSeriesClick when clicked', () => {
    const onClick = vi.fn()
    render(<TopSeries series={seriesData} onSeriesClick={onClick} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onClick).toHaveBeenCalledWith(seriesData[0])
  })

  it('shows loading skeleton when isLoading=true', () => {
    const { container } = render(<TopSeries series={[]} isLoading />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })
})
