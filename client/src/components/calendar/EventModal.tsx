import { useState, useEffect, useRef, useCallback } from 'react'
import { type PendingEvent, usePendingEventsStore } from '../../store/pendingEventsStore'
import { searchPeople, type ContactResult } from '../../api/people'

interface EventModalProps {
  event: PendingEvent | null
  onClose: () => void
  onRevise?: (message: string) => void
  onConfirm?: (event: PendingEvent) => Promise<void> | void
}

function formatForInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ---------------------------------------------------------------------------
// AttendeeInput — chip-based multi-select with contact typeahead
// ---------------------------------------------------------------------------

interface AttendeeInputProps {
  chips: string[]
  onAdd: (email: string) => void
  onRemove: (email: string) => void
}

type DropdownState =
  | { type: 'hidden' }
  | { type: 'loading' }
  | { type: 'results'; contacts: ContactResult[]; focusedIdx: number }
  | { type: 'empty' }
  | { type: 'reauth' }

function AttendeeInput({ chips, onAdd, onRemove }: AttendeeInputProps) {
  const [text, setText] = useState('')
  const [dropdown, setDropdown] = useState<DropdownState>({ type: 'hidden' })
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeDropdown = useCallback(() => {
    setDropdown({ type: 'hidden' })
  }, [])

  const commitText = (value: string) => {
    const email = value.trim()
    if (email && !chips.includes(email)) onAdd(email)
    setText('')
    closeDropdown()
  }

  const selectContact = (c: ContactResult) => {
    if (!chips.includes(c.email)) onAdd(c.email)
    setText('')
    closeDropdown()
    inputRef.current?.focus()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setText(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 1) { closeDropdown(); return }
    setDropdown({ type: 'loading' })
    debounceRef.current = setTimeout(async () => {
      const result = await searchPeople(val.trim())
      if (result.ok) {
        if (result.results.length === 0) {
          setDropdown({ type: 'empty' })
        } else {
          setDropdown({ type: 'results', contacts: result.results, focusedIdx: 0 })
        }
      } else if (result.reason === 'scope_missing') {
        setDropdown({ type: 'reauth' })
      } else {
        setDropdown({ type: 'empty' })
      }
    }, 250)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (dropdown.type === 'results') {
      const { contacts, focusedIdx } = dropdown
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setDropdown({ type: 'results', contacts, focusedIdx: Math.min(focusedIdx + 1, contacts.length - 1) })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setDropdown({ type: 'results', contacts, focusedIdx: Math.max(focusedIdx - 1, 0) })
        return
      }
      if ((e.key === 'Tab' || e.key === 'Enter') && contacts[focusedIdx]) {
        e.preventDefault()
        selectContact(contacts[focusedIdx])
        return
      }
    }
    if (dropdown.type !== 'hidden' && e.key === 'Escape') {
      e.preventDefault()
      closeDropdown()
      return
    }
    if (e.key === 'Enter' || e.key === ',') {
      if (text.trim()) { e.preventDefault(); commitText(text) }
    }
    if (e.key === 'Backspace' && text === '' && chips.length > 0) {
      onRemove(chips[chips.length - 1])
    }
  }

  return (
    <div className="relative">
      <div
        className="w-full min-h-[38px] border border-gray-200 rounded-lg px-2 py-1.5 flex flex-wrap gap-1 focus-within:ring-2 focus-within:ring-blue-200 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-0.5"
          >
            {email}
            <button
              type="button"
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(email) }}
              className="text-blue-500 hover:text-blue-700 leading-none"
              aria-label={`Remove ${email}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => { setTimeout(closeDropdown, 150) }}
          placeholder={chips.length === 0 ? 'Type a name or email…' : ''}
          className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
          style={{ minWidth: '8ch' }}
        />
      </div>

      {dropdown.type !== 'hidden' && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          {dropdown.type === 'loading' && (
            <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>
          )}
          {dropdown.type === 'empty' && (
            <p className="px-3 py-2 text-xs text-gray-400">No contacts found — type a full email and press Enter</p>
          )}
          {dropdown.type === 'reauth' && (
            <p className="px-3 py-2 text-xs text-amber-600">
              Sign out and back in to enable contact search
            </p>
          )}
          {dropdown.type === 'results' && dropdown.contacts.map((c, i) => (
            <button
              key={c.email}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectContact(c) }}
              className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-blue-50 ${
                i === dropdown.focusedIdx ? 'bg-blue-50' : ''
              }`}
            >
              <span className="text-xs font-medium text-gray-800">{c.name}</span>
              <span className="text-xs text-gray-400">{c.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EventModal
// ---------------------------------------------------------------------------

export function EventModal({ event, onClose, onRevise, onConfirm }: EventModalProps) {
  const { removeEvent } = usePendingEventsStore()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [description, setDescription] = useState('')
  const [attendeeChips, setAttendeeChips] = useState<string[]>([])
  const [reviseText, setReviseText] = useState('')
  const [saving, setSaving] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!event) return
    setTitle(event.title)
    setStart(formatForInput(event.start))
    setEnd(formatForInput(event.end))
    setDescription(event.description ?? '')
    setAttendeeChips(event.attendees ?? [])
  }, [event?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!event) return null

  const handleConfirm = async () => {
    const updated: PendingEvent = {
      ...event,
      title,
      start: new Date(start),
      end: new Date(end),
      description,
      attendees: attendeeChips,
    }
    setSaving(true)
    try {
      await onConfirm?.(updated)
    } finally {
      setSaving(false)
    }
    removeEvent(event.id)
    onClose()
  }

  const handleRevise = () => {
    const msg = reviseText.trim() || `Please revise the proposed event "${event.title}"`
    onRevise?.(msg)
    onClose()
  }

  const handleCancel = () => {
    removeEvent(event.id)
    onClose()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Review proposed event"
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-blue-600 font-medium mb-0.5">Proposed event</p>
            <h2 className="text-base font-semibold text-gray-800">Review &amp; confirm</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label htmlFor="event-title" className="text-xs font-medium text-gray-500 mb-1 block">
              Title
            </label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Start and End stacked vertically to prevent datetime-local overflow */}
          <div className="flex flex-col gap-2">
            <div>
              <label htmlFor="event-start" className="text-xs font-medium text-gray-500 mb-1 block">
                Start
              </label>
              <input
                id="event-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label htmlFor="event-end" className="text-xs font-medium text-gray-500 mb-1 block">
                End
              </label>
              <input
                id="event-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Attendees
            </label>
            <AttendeeInput
              chips={attendeeChips}
              onAdd={(email) => setAttendeeChips((prev) => [...prev, email])}
              onRemove={(email) => setAttendeeChips((prev) => prev.filter((e) => e !== email))}
            />
          </div>

          <div>
            <label htmlFor="event-description" className="text-xs font-medium text-gray-500 mb-1 block">
              Description (optional)
            </label>
            <textarea
              id="event-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Ask agent to revise */}
          <div className="border-t border-gray-100 pt-3">
            <label htmlFor="revise-input" className="text-xs font-medium text-gray-500 mb-1 block">
              Ask agent to revise
            </label>
            <div className="flex gap-2">
              <input
                id="revise-input"
                type="text"
                value={reviseText}
                onChange={(e) => setReviseText(e.target.value)}
                placeholder={`Revise "${event.title}" …`}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                onClick={handleRevise}
                className="px-3 py-2 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 shrink-0"
              >
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleCancel}
            aria-label="Cancel event"
            className="flex-1 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            aria-label="Save and confirm event"
            className="flex-1 py-2 text-sm rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
