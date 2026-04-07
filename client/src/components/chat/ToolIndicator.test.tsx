import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToolIndicator } from './ToolIndicator'

describe('ToolIndicator', () => {
  it('renders known tool name as human label', () => {
    render(<ToolIndicator toolName="list_events" status="running" />)
    expect(screen.getByText(/reading calendar/i)).toBeInTheDocument()
  })

  it('falls back to formatted tool name for unknown tools', () => {
    render(<ToolIndicator toolName="my_custom_tool" status="done" />)
    expect(screen.getByText(/my custom tool/i)).toBeInTheDocument()
  })

  it('shows ellipsis when running', () => {
    render(<ToolIndicator toolName="list_events" status="running" />)
    expect(screen.getByRole('status').textContent).toContain('…')
  })

  it('shows duration when done', () => {
    render(<ToolIndicator toolName="list_events" status="done" durationMs={123} />)
    expect(screen.getByRole('status').textContent).toContain('123ms')
  })

  it('shows failed text on error', () => {
    render(<ToolIndicator toolName="list_events" status="error" />)
    expect(screen.getByRole('status').textContent).toContain('failed')
  })

  it('has accessible aria-label', () => {
    render(<ToolIndicator toolName="get_free_slots" status="done" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Finding free time: done')
  })
})
