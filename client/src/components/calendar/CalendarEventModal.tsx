import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { CalendarEvent } from '../../api/calendar'
import { updateEvent } from '../../api/calendar'

interface CalendarEventModalProps {
  event: CalendarEvent | null
  onClose: () => void
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDateTimeLocal(value: string): Date {
  return new Date(value)
}

export function CalendarEventModal({ event, onClose }: CalendarEventModalProps) {
  const queryClient = useQueryClient()
  const overlayRef = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [description, setDescription] = useState('')
  const [attendees, setAttendees] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!event) return
    setTitle(event.summary ?? '')
    setStart(event.start.dateTime ? toDateTimeLocal(event.start.dateTime) : '')
    setEnd(event.end.dateTime ? toDateTimeLocal(event.end.dateTime) : '')
    setDescription(event.description ?? '')
    setAttendees(
      event.attendees
        ?.filter((a) => !a.self)
        .map((a) => a.email)
        .join(', ') ?? ''
    )
    setError(null)
  }, [event])

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleSave = async () => {
    if (!event) return
    setIsSaving(true)
    setError(null)
    try {
      await updateEvent(event.id, {
        title: title.trim() || undefined,
        start: start ? fromDateTimeLocal(start) : undefined,
        end: end ? fromDateTimeLocal(end) : undefined,
        description: description,
        attendees: attendees
          ? attendees.split(',').map((a) => a.trim()).filter(Boolean)
          : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      onClose()
    } catch {
      setError('Failed to save — please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!event) return null

  return (
    <div
      ref={overlayRef}
      data-testid="calendar-event-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        data-testid="calendar-event-modal"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Edit Event</h2>
          <button
            data-testid="modal-close-btn"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Title</label>
          <input
            data-testid="modal-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Start / End — stacked vertically to prevent datetime-local overflow */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Start</label>
            <input
              data-testid="modal-start-input"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">End</label>
            <input
              data-testid="modal-end-input"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Attendees */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Attendees (comma-separated emails)</label>
          <input
            data-testid="modal-attendees-input"
            type="text"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            placeholder="alice@example.com, bob@example.com"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Description</label>
          <textarea
            data-testid="modal-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>

        {error && (
          <p data-testid="modal-error" className="text-xs text-red-500">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            data-testid="modal-cancel-btn"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            data-testid="modal-save-btn"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
