import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './PipeDodger.css'

const W = 480
const H = 640
const GRAVITY = 0.5
const FLAP = -9
const PIPE_WIDTH = 60
const PIPE_GAP = 160
const PIPE_SPEED = 2.5
const PIPE_INTERVAL = 1600 // ms
const BIRD_X = 80
const BIRD_SIZE = 28

function makePipe(x) {
  const gapY = 120 + Math.random() * (H - 240)
  return { x, gapY, scored: false }
}

export default function PipeDodger() {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)
  const lastPipeRef = useRef(0)
  const [screen, setScreen] = useState('idle') // idle | playing | dead
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    const n = parseInt(localStorage.getItem('pd-best'), 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  })

  const initState = () => ({
    bird: { y: H / 2, vy: 0 },
    pipes: [],
    score: 0,
    tick: 0,
  })

  const flap = useCallback(() => {
    if (screen === 'idle') {
      stateRef.current = initState()
      lastPipeRef.current = performance.now()
      setScore(0)
      setScreen('playing')
      return
    }
    if (screen === 'dead') {
      stateRef.current = initState()
      lastPipeRef.current = performance.now()
      setScore(0)
      setScreen('playing')
      return
    }
    if (screen === 'playing') {
      stateRef.current.bird.vy = FLAP
    }
  }, [screen])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  // Draw idle/dead screen
  useEffect(() => {
    if (screen === 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    drawBackground(ctx)
    if (stateRef.current) drawScene(ctx, stateRef.current)
    if (screen === 'idle') drawOverlay(ctx, '🐦 PIPE DODGER', 'SPACE / TAP TO START')
    if (screen === 'dead') drawOverlay(ctx, `SCORE: ${stateRef.current?.score ?? 0}`, 'SPACE / TAP TO RETRY')
  }, [screen, score])

  // Game loop
  useEffect(() => {
    if (screen !== 'playing') return

    const loop = (now) => {
      const s = stateRef.current
      if (!s) return

      // Spawn pipes
      if (now - lastPipeRef.current > PIPE_INTERVAL) {
        s.pipes.push(makePipe(W + 20))
        lastPipeRef.current = now
      }

      // Physics
      s.bird.vy += GRAVITY
      s.bird.y += s.bird.vy

      // Ceiling bounce
      if (s.bird.y - BIRD_SIZE / 2 < 0) {
        s.bird.y = BIRD_SIZE / 2
        s.bird.vy = Math.abs(s.bird.vy) * 0.6
      }

      // Move pipes & score
      for (const p of s.pipes) {
        p.x -= PIPE_SPEED
        if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
          p.scored = true
          s.score += 1
          setScore(s.score)
        }
      }
      s.pipes = s.pipes.filter((p) => p.x + PIPE_WIDTH > 0)

      // Collision — floor or pipes only (ceiling now bounces)
      const dead =
        s.bird.y + BIRD_SIZE / 2 > H ||
        s.pipes.some((p) => {
          const inX = BIRD_X + BIRD_SIZE / 2 - 4 > p.x && BIRD_X - BIRD_SIZE / 2 + 4 < p.x + PIPE_WIDTH
          const inY = s.bird.y - BIRD_SIZE / 2 + 4 < p.gapY - PIPE_GAP / 2 ||
                      s.bird.y + BIRD_SIZE / 2 - 4 > p.gapY + PIPE_GAP / 2
          return inX && inY
        })

      if (dead) {
        if (s.score > best) {
          setBest(s.score)
          localStorage.setItem('pd-best', s.score)
        }
        setScreen('dead')
        return
      }

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      drawBackground(ctx)
      drawScene(ctx, s)
      drawHUD(ctx, s.score, best)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [screen, best])

  return (
    <div className="pd-wrapper">
      <nav className="pd-nav">
        <Link to="/" className="pd-back">← back</Link>
        <span className="pd-title">Pipe Dodger</span>
        <span className="pd-best">best: {best}</span>
      </nav>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="pd-canvas"
        onClick={flap}
      />
    </div>
  )
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

function drawBackground(ctx) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#0d1b2a')
  sky.addColorStop(1, '#1b3a52')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // Ground
  ctx.fillStyle = '#2d4a1e'
  ctx.fillRect(0, H - 40, W, 40)
  ctx.fillStyle = '#3a6226'
  ctx.fillRect(0, H - 40, W, 8)
}

function drawScene(ctx, s) {
  // Pipes
  for (const p of s.pipes) {
    drawPipe(ctx, p.x, 0, p.gapY - PIPE_GAP / 2, false)
    drawPipe(ctx, p.x, p.gapY + PIPE_GAP / 2, H - 40, true)
  }
  // Bird
  drawBird(ctx, BIRD_X, s.bird.y, s.bird.vy)
}

function drawPipe(ctx, x, yTop, yBottom, flipped) {
  const h = yBottom - yTop
  const capH = 18
  const capW = PIPE_WIDTH + 10

  ctx.fillStyle = '#3a7a1a'
  ctx.fillRect(x, yTop, PIPE_WIDTH, h)

  // Highlight stripe
  ctx.fillStyle = '#4fa020'
  ctx.fillRect(x + 6, yTop, 8, h)

  // Cap
  ctx.fillStyle = '#2d6014'
  if (!flipped) {
    ctx.fillRect(x - 5, yBottom - capH, capW, capH)
  } else {
    ctx.fillRect(x - 5, yTop, capW, capH)
  }
}

function drawBird(ctx, x, y, vy) {
  const tilt = Math.max(-0.5, Math.min(1.2, vy * 0.06))
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)

  // Body
  ctx.fillStyle = '#f7c948'
  ctx.beginPath()
  ctx.ellipse(0, 0, BIRD_SIZE / 2, BIRD_SIZE / 2 - 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Wing
  ctx.fillStyle = '#e0a820'
  ctx.beginPath()
  ctx.ellipse(-4, 4, 8, 5, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // Eye
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(7, -4, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(8, -4, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Beak
  ctx.fillStyle = '#e05c00'
  ctx.beginPath()
  ctx.moveTo(12, -1)
  ctx.lineTo(20, 2)
  ctx.lineTo(12, 5)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

function drawHUD(ctx, score, best) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, W, 48)

  ctx.fillStyle = '#00e5ff'
  ctx.font = 'bold 22px "Courier New"'
  ctx.textAlign = 'left'
  ctx.fillText(`score: ${score}`, 16, 32)

  ctx.fillStyle = '#888'
  ctx.font = '14px "Courier New"'
  ctx.textAlign = 'right'
  ctx.fillText(`best: ${best}`, W - 16, 32)
}

function drawOverlay(ctx, line1, line2) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#00e5ff'
  ctx.font = 'bold 32px "Courier New"'
  ctx.fillText(line1, W / 2, H / 2 - 20)

  ctx.fillStyle = '#aaa'
  ctx.font = '16px "Courier New"'
  ctx.fillText(line2, W / 2, H / 2 + 20)
}
