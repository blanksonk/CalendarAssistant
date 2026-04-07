export interface AuthUser {
  id: string
  email: string
  name: string
  picture: string | null
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export function getGoogleLoginUrl(): string {
  return '/api/auth/google'
}
