import { usePendingEventsStore } from '../../store/pendingEventsStore'

export interface ProposedEvent {
  id: string
  title: string
  start: string
  end: string
  attendees?: string[]
  description?: string
}

interface EventProposalCardProps {
  event: ProposedEvent
  onRevise?: (message: string) => void
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

function durationLabel(start: string, end: string): string {
  try {
    const mins = (new Date(end).getTime() - new Date(start).getTime()) / 60000
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}h ${m}m` : `${h}h`
  } catch {
    return ''
  }
}

export function EventProposalCard({ event, onRevise }: EventProposalCardProps) {
  const addEvent = usePendingEventsStore((s) => s.addEvent)

  const handleConfirm = () => {
    addEvent({
      id: event.id,
      title: event.title,
      start: new Date(event.start),
      end: new Date(event.end),
      attendees: event.attendees,
      description: event.description,
    })
  }

  const handleRevise = () => {
    const msg = `Please revise the proposed event "${event.title}" — `
    onRevise?.(msg)
  }

  return (
    <div
      role="article"
      aria-label={`Proposed event: ${event.title}`}
      className="border border-blue-200 rounded-xl p-3 bg-blue-50 flex flex-col gap-2 text-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-800">{event.title}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {formatDateTime(event.start)}
            <span className="mx-1">·</span>
            {durationLabel(event.start, event.end)}
          </p>
        </div>
        <span className="text-xs text-blue-600 font-medium bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">
          Proposed
        </span>
      </div>

      {event.attendees && event.attendees.length > 0 && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">With:</span> {event.attendees.join(', ')}
        </p>
      )}

      {event.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{event.description}</p>
      )}

      <div className="flex gap-2 mt-1">
        <button
          onClick={handleConfirm}
          aria-label="Confirm event"
          className="flex-1 text-xs py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
        >
          Add to calendar
        </button>
        <button
          onClick={handleRevise}
          aria-label="Revise event"
          className="flex-1 text-xs py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Ask to revise
        </button>
      </div>
    </div>
  )
}
