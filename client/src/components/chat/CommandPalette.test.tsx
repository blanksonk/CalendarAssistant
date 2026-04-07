import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from './CommandPalette'

describe('CommandPalette', () => {
  it('renders heading', () => {
    render(<CommandPalette onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/quick actions/i)).toBeInTheDocument()
  })

  it('renders all quick action buttons', () => {
    render(<CommandPalette onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/schedule a meeting/i)).toBeInTheDocument()
    expect(screen.getByText(/find free time/i)).toBeInTheDocument()
    expect(screen.getByText(/insights/i)).toBeInTheDocument()
  })

  it('calls onSelect with correct text and onClose when action clicked', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette onSelect={onSelect} onClose={onClose} />)
    fireEvent.click(screen.getByText(/find free time/i))
    expect(onSelect).toHaveBeenCalledWith('Find me a 1-hour free slot this week')
    expect(onClose).toHaveBeenCalled()
  })

  it('has listbox role for accessibility', () => {
    render(<CommandPalette onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
