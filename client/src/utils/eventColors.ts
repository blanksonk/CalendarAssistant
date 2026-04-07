import type { CalendarEvent } from '../api/calendar'

export type EventColorClass = {
  bg: string
  border: string
  text: string
}

/**
 * Color-code events by type:
 * - 1:1 (2 attendees incl. self) → blue
 * - Standup (title contains "standup" or "scrum" or "daily") → purple
 * - External meeting (organizer not self) → orange
 * - Large meeting (3+ attendees) → red
 * - Default → teal
 */
export function eventColorClass(event: CalendarEvent): EventColorClass {
  const title = (event.summary ?? '').toLowerCase()
  const attendees = event.attendees ?? []
  const attendeeCount = attendees.length

  const isStandup =
    title.includes('standup') ||
    title.includes('stand-up') ||
    title.includes('scrum') ||
    title.includes('daily sync')

  const isExternal =
    event.organizer && !event.organizer.self

  const is1on1 = attendeeCount === 2

  if (isStandup) {
    return { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' }
  }
  if (isExternal) {
    return { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' }
  }
  if (is1on1) {
    return { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' }
  }
  if (attendeeCount >= 3) {
    return { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-800' }
  }
  return { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-800' }
}
