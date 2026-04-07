import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopPeople } from './TopPeople'
import type { TopPerson } from '../../api/insights'

const people: TopPerson[] = [
  { email: 'alice@example.com', count: 5 },
  { email: 'bob@example.com', count: 3 },
  { email: 'carol@example.com', count: 1 },
]

describe('TopPeople', () => {
  it('renders section heading', () => {
    render(<TopPeople people={people} />)
    expect(screen.getByRole('region', { name: /top people/i })).toBeInTheDocument()
  })

  it('renders all people in order', () => {
    render(<TopPeople people={people} />)
    const items = screen.getAllByRole('button')
    expect(items[0].getAttribute('aria-label')).toContain('alice@example.com')
    expect(items[1].getAttribute('aria-label')).toContain('bob@example.com')
  })

  it('shows meeting counts in aria-labels', () => {
    render(<TopPeople people={people} />)
    expect(screen.getByRole('button', { name: /alice@example.com, 5 meetings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bob@example.com, 3 meetings/i })).toBeInTheDocument()
  })

  it('shows empty state when no people', () => {
    render(<TopPeople people={[]} />)
    expect(screen.getByText(/no meeting data/i)).toBeInTheDocument()
  })

  it('calls onPersonClick when button clicked', () => {
    const onClick = vi.fn()
    render(<TopPeople people={people} onPersonClick={onClick} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onClick).toHaveBeenCalledWith(people[0])
  })

  it('shows loading skeleton when isLoading=true', () => {
    const { container } = render(<TopPeople people={[]} isLoading />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })
})
