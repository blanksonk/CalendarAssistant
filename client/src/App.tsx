import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">CalendarAssistant — scaffold</p>
      </div>
    </QueryClientProvider>
  )
}

export default App
