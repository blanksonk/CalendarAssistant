import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  it('renders textarea with placeholder', () => {
    render(<ChatInput value="" onChange={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument()
  })

  it('calls onChange when user types', () => {
    const onChange = vi.fn()
    render(<ChatInput value="" onChange={onChange} onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('calls onSubmit on Enter (no shift)', () => {
    const onSubmit = vi.fn()
    render(<ChatInput value="test message" onChange={vi.fn()} onSubmit={onSubmit} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false })
    expect(onSubmit).toHaveBeenCalledWith('test message')
  })

  it('does not call onSubmit on Shift+Enter', () => {
    const onSubmit = vi.fn()
    render(<ChatInput value="test" onChange={vi.fn()} onSubmit={onSubmit} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables textarea and send button when disabled=true', () => {
    render(<ChatInput value="x" onChange={vi.fn()} onSubmit={vi.fn()} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('send button disabled when value is empty', () => {
    render(<ChatInput value="" onChange={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('calls onSubmit when send button clicked', () => {
    const onSubmit = vi.fn()
    render(<ChatInput value="hello" onChange={vi.fn()} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSubmit).toHaveBeenCalledWith('hello')
  })

  it('shows @ mention hint in placeholder', () => {
    render(<ChatInput value="" onChange={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByPlaceholderText(/@ to mention/i)).toBeInTheDocument()
  })
})
