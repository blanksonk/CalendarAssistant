import { create } from 'zustand'

export interface PendingEvent {
  id: string
  title: string
  start: Date
  end: Date
  attendees?: string[]
  description?: string
}

interface PendingEventsState {
  events: PendingEvent[]
  addEvent: (event: PendingEvent) => void
  removeEvent: (id: string) => void
  updateEvent: (id: string, updates: Partial<PendingEvent>) => void
  clear: () => void
}

export const usePendingEventsStore = create<PendingEventsState>((set) => ({
  events: [],

  addEvent: (event) =>
    set((state) => ({ events: [...state.events, event] })),

  removeEvent: (id) =>
    set((state) => ({ events: state.events.filter((e) => e.id !== id) })),

  updateEvent: (id, updates) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  clear: () => set({ events: [] }),
}))
