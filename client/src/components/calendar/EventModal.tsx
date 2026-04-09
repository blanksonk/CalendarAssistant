import { useState, useEffect, useRef } from 'react'
import { type PendingEvent, usePendingEventsStore } from '../../store/pendingEventsStore'

interface EventModalProps {
  event: PendingEvent | null
  onClose: () => void
  onRevise?: (message: string) => void
  onConfirm?: (event: PendingEvent) => Promise<void> | void
}

function formatForInput(date: Date): string {
  // Returns "YYYY-MM-DDTHH:MM" for datetime-local inputs
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function EventModal({ event, onClose, onRevise, onConfirm }: EventModalProps) {
  const { removeEvent } = usePendingEventsStore()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [description, setDescription] = useState('')
  const [attendees, setAttendees] = useState('')
  const [reviseText, setReviseText] = useState('')
  const [saving, setSaving] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!event) return
    setTitle(event.title)
    setStart(formatForInput(event.start))
    setEnd(formatForInput(event.end))
    setDescription(event.description ?? '')
    setAttendees((event.attendees ?? []).join(', '))
  }, [event?.id])

  // Close on Escape
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
      attendees: attendees ? attendees.split(',').map((a) => a.trim()).filter(Boolean) : [],
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
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

          <div className="grid grid-cols-2 gap-2">
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
            <label htmlFor="event-attendees" className="text-xs font-medium text-gray-500 mb-1 block">
              Attendees (comma-separated)
            </label>
            <input
              id="event-attendees"
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
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
