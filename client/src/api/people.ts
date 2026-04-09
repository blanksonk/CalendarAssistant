export interface ContactResult {
  name: string
  email: string
}

export type PeopleSearchResult =
  | { ok: true; results: ContactResult[] }
  | { ok: false; reason: 'scope_missing' | 'error' }

export async function searchPeople(q: string): Promise<PeopleSearchResult> {
  if (!q.trim()) return { ok: true, results: [] }
  try {
    const resp = await fetch(`/api/people/search?q=${encodeURIComponent(q)}`, {
      credentials: 'include',
    })
    if (resp.status === 403) {
      const body = await resp.json().catch(() => ({}))
      if (body?.detail === 'contacts_scope_missing') {
        return { ok: false, reason: 'scope_missing' }
      }
      return { ok: false, reason: 'error' }
    }
    if (!resp.ok) return { ok: false, reason: 'error' }
    const data = await resp.json()
    return { ok: true, results: data.results ?? [] }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
