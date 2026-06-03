import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Brush, Loader2, Sparkles } from 'lucide-react'
import { API_URL } from '../lib/api'
import { SakinaAvatar } from './SakinaAvatar'

function drawSetup(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = '#6f675d'
  ctx.fillStyle = '#f0e9d6'
  ctx.fillRect(0, 0, rect.width, rect.height)
  return ctx
}

function pointFromEvent(canvas: HTMLCanvasElement, event: PointerEvent | ReactPointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

export function ScribbleCard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawingRef = useRef(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reflection, setReflection] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const configure = () => {
      ctxRef.current = drawSetup(canvas)
      setHasDrawing(false)
      setReflection('')
      setError(null)
    }

    configure()
    window.addEventListener('resize', configure)
    return () => window.removeEventListener('resize', configure)
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return

    const point = pointFromEvent(canvas, event)
    drawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    setHasDrawing(true)
    setError(null)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return

    const point = pointFromEvent(canvas, event)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const endDrawing = (event?: ReactPointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    ctxRef.current = drawSetup(canvas)
    drawingRef.current = false
    setHasDrawing(false)
    setReflection('')
    setError(null)
  }

  const handleAnalyze = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawing || isAnalyzing) return

    setIsAnalyzing(true)
    setError(null)
    setReflection('')

    try {
      const response = await fetch(`${API_URL}/scribble/reflect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data_url: canvas.toDataURL('image/png'),
        }),
      })

      const payload = (await response.json().catch(() => null)) as { reflection?: string; detail?: string } | null

      if (!response.ok) {
        throw new Error(payload?.detail || 'Sakina could not reflect on the drawing right now.')
      }

      if (!payload?.reflection?.trim()) {
        throw new Error('The reflection came back empty. Please try again.')
      }

      setReflection(payload.reflection.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the scribble right now.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <section className="scribble-card" aria-label="Scribble what you feel">
      <div className="scribble-card__header">
        <div className="scribble-card__title-wrap">
          <div className="letter-card__title-icon-wrap">
            <Brush size={18} className="scribble-card__title-icon" aria-hidden />
          </div>
          <div>
            <p className="panel-card__label">Scribble</p>
            <h3 className="scribble-card__title">Scribble what you feel</h3>
          </div>
        </div>
      </div>

      <p className="scribble-card__sub">
        No one sees this. Sakina will reflect back what she notices in the drawing.
      </p>

      <canvas
        ref={canvasRef}
        className="scribble-card__canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrawing}
        onPointerLeave={endDrawing}
        onPointerCancel={endDrawing}
      />

      <div className="scribble-card__actions">
        <button
          type="button"
          className="scribble-card__btn scribble-card__btn--ghost"
          onClick={handleClear}
        >
          Clear
        </button>
        <button
          type="button"
          className="scribble-card__btn scribble-card__btn--primary"
          onClick={() => void handleAnalyze()}
          disabled={!hasDrawing || isAnalyzing}
        >
          {isAnalyzing ? <Loader2 size={15} className="spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
          <span>{isAnalyzing ? 'Looking...' : 'Sakina, look'}</span>
        </button>
      </div>

      {error ? <p className="status-note is-error">{error}</p> : null}

      {reflection ? (
        <div className="scribble-card__mirror">
          <div className="scribble-card__avatar" aria-hidden>
            <SakinaAvatar emotion="love" size="xs" breathe={false} />
          </div>
          <span>{reflection}</span>
        </div>
      ) : null}
    </section>
  )
}
