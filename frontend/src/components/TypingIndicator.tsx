/** Three-dot typing indicator shown during 'submitted' status (before meta arrives) */
export function TypingIndicator() {
  return (
    <div className="msg-row assistant" role="status" aria-label="Sakina is composing">
      <div
        className="msg-bubble"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '12px 16px',
        }}
      >
        <span className="typing-dot" style={{ animationDelay: '0ms' }} aria-hidden />
        <span className="typing-dot" style={{ animationDelay: '150ms' }} aria-hidden />
        <span className="typing-dot" style={{ animationDelay: '300ms' }} aria-hidden />
      </div>
    </div>
  )
}
