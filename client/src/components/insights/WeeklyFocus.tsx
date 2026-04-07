interface WeeklyFocusProps {
  narrative: string | null
  isLoading?: boolean
}

export function WeeklyFocus({ narrative, isLoading }: WeeklyFocusProps) {
  if (isLoading) {
    return (
      <section aria-label="Weekly Focus" className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Weekly Focus
        </h3>
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/6" />
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Weekly Focus" className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 shadow-sm border border-blue-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </span>
        <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">
          Weekly Focus
        </h3>
      </div>

      {narrative ? (
        <p className="text-sm text-blue-900 leading-relaxed">{narrative}</p>
      ) : (
        <p className="text-sm text-blue-400 italic">
          No focus narrative available for this week yet.
        </p>
      )}
    </section>
  )
}
