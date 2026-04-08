import type { TopPerson } from '../../api/insights'

interface TopPeopleProps {
  people: TopPerson[]
  onPersonClick?: (person: TopPerson) => void
  isLoading?: boolean
}

function initial(email: string): string {
  return email[0].toUpperCase()
}

function displayName(email: string): string {
  return email.split('@')[0].replace(/[._-]/g, ' ')
}

export function TopPeople({ people, onPersonClick, isLoading }: TopPeopleProps) {
  return (
    <section aria-label="Top people" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Top 5 people
      </h4>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
              <div className="w-6 h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : people.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No meeting data for this week.</p>
      ) : (
        <ol className="space-y-2">
          {people.map((person, i) => (
            <li key={person.email}>
              <button
                onClick={() => onPersonClick?.(person)}
                className="w-full flex items-center gap-3 hover:bg-gray-50 rounded-lg px-1 py-1 transition-colors text-left"
                aria-label={`${person.email}, ${person.count} meetings`}
              >
                <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {initial(person.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate capitalize">{displayName(person.email)}</p>
                  <p className="text-xs text-gray-400 truncate">{person.email}</p>
                </div>
                <span className="text-sm font-semibold text-gray-600 shrink-0">{person.count}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
