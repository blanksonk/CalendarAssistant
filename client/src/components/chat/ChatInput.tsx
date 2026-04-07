import { useRef, useEffect } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (text: string) => void
  disabled?: boolean
  onPaletteToggle?: () => void
}

export function ChatInput({ value, onChange, onSubmit, disabled, onPaletteToggle }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(value)
    }
  }

  return (
    <div className="px-3 pb-3 shrink-0">
      <div className="flex items-end gap-2 bg-gray-100 rounded-2xl px-3 py-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything… (⌘K for shortcuts)"
          rows={1}
          disabled={disabled}
          aria-label="Chat message input"
          className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400 max-h-32 disabled:opacity-50"
          style={{ minHeight: '24px' }}
        />
        <button
          type="button"
          onClick={onPaletteToggle}
          title="Quick actions (⌘K)"
          className="w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 flex items-center justify-center shrink-0"
          aria-label="Open command palette"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l3-3 3 3M9 15l3 3 3-3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onSubmit(value)}
          disabled={!value.trim() || disabled}
          aria-label="Send message"
          className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
