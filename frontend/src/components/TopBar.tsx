import { Trash2 } from 'lucide-react'

interface TopBarProps {
  onClear: () => void
}

export function TopBar({ onClear }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand">
          <span>Sakina</span>
          <span className="dot-divider">·</span>
          <span className="sub">Here with you</span>
        </div>
      </div>
      <div className="topbar-right">
        <button className="icon-btn" onClick={onClear} title="Clear chat" aria-label="Clear chat">
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
