/**
 * ErrorBoundary — catches render-time errors from untrusted LLM/RAG content.
 * Shows a calm bilingual fallback (English + Arabic) with a page refresh affordance.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Non-fatal: log to console so devs can inspect, but don't surface raw stack to users
    console.error('[Sakina] Render error caught by ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#E5DFCC',
          padding: 24,
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        }}
        role="alert"
        aria-live="assertive"
      >
        <div
          style={{
            background: '#F7F4EA',
            borderRadius: 24,
            padding: '40px 32px',
            maxWidth: 400,
            textAlign: 'center',
            boxShadow: '0 4px 32px rgba(45, 59, 54, 0.08)',
            border: '1px solid rgba(217, 210, 190, 0.5)',
          }}
        >
          <p
            style={{
              fontSize: 16,
              color: '#2D3B36',
              lineHeight: 1.6,
              margin: '0 0 8px',
            }}
          >
            Something went wrong — please refresh.
          </p>
          <p
            dir="rtl"
            lang="ar"
            style={{
              fontSize: 16,
              color: '#5C6B65',
              lineHeight: 1.7,
              margin: '0 0 24px',
              fontFamily: 'Cairo, Tajawal, ui-sans-serif, system-ui, sans-serif',
            }}
          >
            حدث خطأ ما — يرجى تحديث الصفحة.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              appearance: 'none',
              border: 0,
              background: '#5C8374',
              color: '#fff',
              padding: '10px 28px',
              borderRadius: 12,
              fontSize: 14,
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            aria-label="Refresh the page / تحديث الصفحة"
          >
            Refresh / تحديث
          </button>
        </div>
      </div>
    )
  }
}
