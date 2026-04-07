import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMe, logout as apiLogout, getGoogleLoginUrl, type AuthUser } from '../api/auth'

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const login = () => {
    window.location.href = getGoogleLoginUrl()
  }

  const logout = async () => {
    await apiLogout()
    queryClient.setQueryData(['auth', 'me'], null)
    queryClient.clear()
  }

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  }
}
