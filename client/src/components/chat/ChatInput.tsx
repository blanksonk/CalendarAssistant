import { useRef, useEffect, useState, useCallback } from 'react'
import { searchPeople, type ContactResult } from '../../api/people'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (text: string) => void
  disabled?: boolean
}

/** Extract the @ mention query at the end of the text up to `cursorPos`. */
function getMentionQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/@(\S*)$/)
  return match ? match[1] : null
}

export function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [contacts, setContacts] = useState<ContactResult[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [focusedIdx, setFocusedIdx] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [value])

  const closeMention = useCallback(() => {
    setContacts([])
    setMentionQuery(null)
    setFocusedIdx(0)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    const cursor = e.target.selectionStart ?? newValue.length
    const query = getMentionQuery(newValue, cursor)

    if (query === null) {
      closeMention()
      return
    }

    setMentionQuery(query)
    setFocusedIdx(0)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length === 0) {
      // Show nothing until at least 1 char typed after @
      setContacts([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchPeople(query)
      setContacts(results)
    }, 250)
  }

  const insertContact = (contact: ContactResult) => {
    const cursor = ref.current?.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const after = value.slice(cursor)
    // Replace @query with the email
    const replaced = before.replace(/@(\S*)$/, contact.email)
    const newValue = replaced + after
    onChange(newValue)
    closeMention()
    // Restore focus
    setTimeout(() => {
      ref.current?.focus()
      const pos = replaced.length
      ref.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (contacts.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx((i) => Math.min(i + 1, contacts.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (contacts[focusedIdx]) {
          e.preventDefault()
          insertContact(contacts[focusedIdx])
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMention()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(value)
    }
  }

  const showDropdown = contacts.length > 0 && mentionQuery !== null

  return (
    <div className="px-3 pb-3 shrink-0">
      <div className="relative">
        {/* @ mention dropdown */}
        {showDropdown && (
          <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
            {contacts.map((c, i) => (
              <button
                key={c.email}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertContact(c) }}
                className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-blue-50 ${
                  i === focusedIdx ? 'bg-blue-50' : ''
                }`}
              >
                <span className="text-xs font-medium text-gray-800">{c.name}</span>
                <span className="text-xs text-gray-400">{c.email}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-gray-100 rounded-2xl px-3 py-2">
          <textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (type @ to mention someone)"
            rows={1}
            disabled={disabled}
            aria-label="Chat message input"
            className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400 max-h-32 disabled:opacity-50"
            style={{ minHeight: '24px' }}
          />
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
    </div>
  )
}
