import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatMessage, Message } from './ChatMessage'

const userMsg: Message = { id: '1', role: 'user', content: 'Hello there' }
const assistantMsg: Message = { id: '2', role: 'assistant', content: 'Hi! How can I help?' }

describe('ChatMessage', () => {
  it('renders user message content', () => {
    render(<ChatMessage message={userMsg} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    render(<ChatMessage message={assistantMsg} />)
    expect(screen.getByText(/how can i help/i)).toBeInTheDocument()
  })

  it('renders bold markdown', () => {
    const msg: Message = { id: '3', role: 'assistant', content: '**important**' }
    render(<ChatMessage message={msg} />)
    expect(document.querySelector('strong')?.textContent).toBe('important')
  })

  it('renders typing indicator when streaming with empty content', () => {
    const msg: Message = { id: '4', role: 'assistant', content: '', isStreaming: true }
    render(<ChatMessage message={msg} />)
    // Three bounce dots
    const dots = document.querySelectorAll('.animate-bounce')
    expect(dots.length).toBe(3)
  })

  it('renders tool call indicators', () => {
    const msg: Message = {
      id: '5',
      role: 'assistant',
      content: 'Done',
      toolCalls: [
        { id: 'tc1', toolName: 'list_events', status: 'done', durationMs: 200 },
        { id: 'tc2', toolName: 'get_free_slots', status: 'running' },
      ],
    }
    render(<ChatMessage message={msg} />)
    expect(screen.getByText(/reading calendar/i)).toBeInTheDocument()
    expect(screen.getByText(/finding free time/i)).toBeInTheDocument()
  })

  it('does not render tool indicators for user messages', () => {
    const msg: Message = {
      id: '6',
      role: 'user',
      content: 'hi',
      toolCalls: [{ id: 'tc1', toolName: 'list_events', status: 'done' }],
    }
    render(<ChatMessage message={msg} />)
    expect(screen.queryByText(/reading calendar/i)).not.toBeInTheDocument()
  })
})
