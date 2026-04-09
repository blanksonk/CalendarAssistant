export interface ContactResult {
  name: string
  email: string
}

export async function searchPeople(q: string): Promise<ContactResult[]> {
  if (!q.trim()) return []
  try {
    const resp = await fetch(`/api/people/search?q=${encodeURIComponent(q)}`, {
      credentials: 'include',
    })
    if (!resp.ok) return []
    const data = await resp.json()
    return data.results ?? []
  } catch {
    return []
  }
}
