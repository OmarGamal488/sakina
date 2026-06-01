/**
 * SuggestedActions — 3 quick-reply chips that send a follow-up message via onAction.
 */

interface SuggestedActionsProps {
  onAction: (text: string) => void
}

const CHIPS = [
  'Tell me more',
  'I just need to vent',
  'I\'d like a coping tip',
]

export function SuggestedActions({ onAction }: SuggestedActionsProps) {
  return (
    <div className="widget-card" role="region" aria-label="Quick replies">
      <p className="widget-title">What would help most?</p>
      <div className="widget-chips" role="group" aria-label="Quick reply options">
        {CHIPS.map(chip => (
          <button
            key={chip}
            className="widget-chip"
            onClick={() => onAction(chip)}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
