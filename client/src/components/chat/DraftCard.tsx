export interface DraftData {
  draft_id: string
  to: string
  subject: string
  body_snippet: string
  gmail_url: string
}

interface DraftCardProps {
  draft: DraftData
  onRevise?: (message: string) => void
}

export function DraftCard({ draft, onRevise }: DraftCardProps) {
  const handleRevise = () => {
    onRevise?.(`Please revise the email draft for "${draft.subject}" — `)
  }

  return (
    <div
      role="article"
      aria-label={`Email draft: ${draft.subject}`}
      className="border border-gray-200 rounded-xl p-3 bg-white flex flex-col gap-2 text-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-800">{draft.subject}</p>
          <p className="text-xs text-gray-500 mt-0.5">To: {draft.to}</p>
        </div>
        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
          Draft
        </span>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 border-l-2 border-gray-200 pl-2 italic">
        {draft.body_snippet}
      </p>

      <div className="flex gap-2 mt-1">
        <a
          href={draft.gmail_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open draft in Gmail"
          className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-900 font-medium text-center"
        >
          View in Gmail ↗
        </a>
        <button
          onClick={handleRevise}
          aria-label="Revise draft"
          className="flex-1 text-xs py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Ask to revise
        </button>
      </div>
    </div>
  )
}
