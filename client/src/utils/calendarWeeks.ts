/** Build weeks (Mon–Sun arrays) covering the reference month */
export function buildMonthWeeks(date: Date): Date[][] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  const startDay = new Date(firstOfMonth)
  const dow = startDay.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  startDay.setDate(startDay.getDate() + diff)

  const weeks: Date[][] = []
  const cursor = new Date(startDay)

  while (cursor <= lastOfMonth || weeks.length < 4) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    if (cursor > lastOfMonth && weeks.length >= 4) break
  }
  return weeks
}
