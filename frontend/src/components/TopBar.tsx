import { Menu, Trash2 } from 'lucide-react'

interface TopBarProps {
  onClear: () => void
  onMenuToggle: () => void
}

export function TopBar({ onClear, onMenuToggle }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="icon-btn" onClick={onMenuToggle} title="Open menu" aria-label="Open menu">
          <Menu size={16} aria-hidden />
        </button>
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
