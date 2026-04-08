import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  workStartHour: number  // 0–23, default 9
  workEndHour: number    // 0–23, default 18
  setWorkHours: (start: number, end: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      workStartHour: 9,
      workEndHour: 18,
      setWorkHours: (start, end) => set({ workStartHour: start, workEndHour: end }),
    }),
    { name: 'ca-settings' }
  )
)
