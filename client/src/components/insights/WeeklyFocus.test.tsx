import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeeklyFocus } from './WeeklyFocus'

describe('WeeklyFocus', () => {
  it('renders narrative text', () => {
    render(<WeeklyFocus narrative="You had a productive week focused on planning." />)
    expect(screen.getByText(/productive week/)).toBeInTheDocument()
  })

  it('shows section label', () => {
    render(<WeeklyFocus narrative="Some narrative" />)
    expect(screen.getByRole('region', { name: /weekly focus/i })).toBeInTheDocument()
  })

  it('shows placeholder when narrative is null', () => {
    render(<WeeklyFocus narrative={null} />)
    expect(screen.getByText(/no focus narrative/i)).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading is true', () => {
    render(<WeeklyFocus narrative={null} isLoading />)
    const section = screen.getByRole('region', { name: /weekly focus/i })
    // Skeleton has animate-pulse
    expect(section.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('does not show loading skeleton when isLoading is false', () => {
    render(<WeeklyFocus narrative="Some text" isLoading={false} />)
    expect(screen.getByText('Some text')).toBeInTheDocument()
    expect(screen.queryByText(/animate-pulse/)).not.toBeInTheDocument()
  })
})
