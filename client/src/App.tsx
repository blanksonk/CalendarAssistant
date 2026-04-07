import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './components/auth/LoginPage'
import { useAuth } from './hooks/useAuth'

const queryClient = new QueryClient()

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  // AppShell will be added in step-9a
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Authenticated — AppShell coming soon</p>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
