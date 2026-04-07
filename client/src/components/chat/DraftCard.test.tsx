import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DraftCard, DraftData } from './DraftCard'

const mockDraft: DraftData = {
  draft_id: 'draft-abc',
  to: 'alice@example.com',
  subject: 'Follow-up on our meeting',
  body_snippet: 'Hi Alice, it was great meeting you today...',
  gmail_url: 'https://mail.google.com/mail/u/0/#drafts/draft-abc',
}

describe('DraftCard', () => {
  it('renders subject', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByText('Follow-up on our meeting')).toBeInTheDocument()
  })

  it('renders recipient', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument()
  })

  it('renders body snippet', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByText(/great meeting you today/)).toBeInTheDocument()
  })

  it('shows Draft badge', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('View in Gmail link has correct href and target', () => {
    render(<DraftCard draft={mockDraft} />)
    const link = screen.getByRole('link', { name: /gmail/i })
    expect(link).toHaveAttribute('href', mockDraft.gmail_url)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('calls onRevise with prefilled text', () => {
    const onRevise = vi.fn()
    render(<DraftCard draft={mockDraft} onRevise={onRevise} />)
    fireEvent.click(screen.getByRole('button', { name: /revise/i }))
    expect(onRevise).toHaveBeenCalledWith(expect.stringContaining('Follow-up on our meeting'))
  })

  it('has article role', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByRole('article')).toBeInTheDocument()
  })
})
