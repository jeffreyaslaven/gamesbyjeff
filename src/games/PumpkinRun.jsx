import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './PumpkinRun.css'

const W = 800
const H = 300
const GROUND_Y = H - 50
const DINO_X = 80
const DINO_W = 44
const DINO_H = 52
const GRAVITY = 0.8
const JUMP_V = -15
const DUCK_H = 28

// Dog spawns at the one height where ducking saves you but standing gets hit
const DOG_Y = GROUND_Y - 65

function makeYarn(x, size = 'sm') {
  const sizes = { sm: { w: 26, h: 26 }, md: { w: 34, h: 34 }, lg: { w: 34, h: 34, double: true } }
  const t = sizes[size] ?? sizes.sm
  return { x, w: t.double ? 70 : t.w, h: t.h, double: !!t.double, size, type: 'yarn' }
}

function makeDog(x) {
  return { x, y: DOG_Y, w: 52, h: 34, legFrame: 0, legTick: 0, type: 'dog' }
}

// Returns an array of obstacles to push (supports combos)
function spawnObstacles(score, speed, existing = []) {
  const x = W + 20
  // How close (px) an existing obstacle must be to block a conflicting type
  const CONFLICT_ZONE = 350
  const nearDog  = existing.some(o => o.type === 'dog'  && o.x > x - CONFLICT_ZONE)
  const nearYarn = existing.some(o => o.type === 'yarn' && o.x > x - CONFLICT_ZONE)
  // Air time = 2 * JUMP_V / GRAVITY = 37.5 frames
  // quickGap: land + ~12 frames to react and jump again
  const quickGap = Math.round(speed * 52)
  // comfyGap: generous breathing room
  const comfyGap = Math.round(speed * 70)

  // Tiers unlock gradually — player gets comfortable before each new challenge
  const tier = score < 50  ? 0   // single small yarn only
             : score < 80  ? 1   // + medium yarn (still single)
             : score < 120 ? 2   // + wide yarn, easy double jump
             : score < 170 ? 3   // + dogs, yarn→dog
             : score < 230 ? 4   // + tight double, dog→yarn
             :               5   // + triple, dog sandwich, two dogs

  // Build weighted pool for this tier
  const pool = []

  // Always available: single small yarn
  pool.push({ w: 5, fn: () => [makeYarn(x, 'sm')] })

  if (tier >= 1) {
    // Medium yarn — single obstacle, just taller
    pool.push({ w: 4, fn: () => [makeYarn(x, 'md')] })
  }

  if (tier >= 2) {
    // Wide double yarn (side by side) — only if no dog nearby
    if (!nearDog) pool.push({ w: 3, fn: () => [makeYarn(x, 'lg')] })
    // Easy double jump — two yarns with a comfy gap
    pool.push({ w: 3, fn: () => [makeYarn(x, 'sm'), makeYarn(x + comfyGap, 'sm')] })
  }

  if (tier >= 3) {
    // Single dog — only if no yarn nearby
    if (!nearYarn) pool.push({ w: 3, fn: () => [makeDog(x)] })
    // Yarn then dog (jump then duck) — self-contained
    pool.push({ w: 2, fn: () => [makeYarn(x, 'sm'), makeDog(x + comfyGap)] })
  }

  if (tier >= 4) {
    // Tight double jump — requires quick re-jump
    pool.push({ w: 3, fn: () => [makeYarn(x, 'md'), makeYarn(x + quickGap, 'sm')] })
    // Dog then yarn (duck then jump) — self-contained
    pool.push({ w: 2, fn: () => [makeDog(x), makeYarn(x + comfyGap, 'md')] })
  }

  if (tier >= 5) {
    // Triple yarn run
    pool.push({ w: 2, fn: () => [makeYarn(x, 'sm'), makeYarn(x + quickGap, 'sm'), makeYarn(x + quickGap * 2, 'sm')] })
    // Dog sandwich — self-contained
    pool.push({ w: 2, fn: () => [makeYarn(x, 'md'), makeDog(x + quickGap)] })
    // Two dogs — only if no yarn nearby
    if (!nearYarn) pool.push({ w: 1, fn: () => [makeDog(x), makeDog(x + comfyGap)] })
  }

  // Weighted pick
  const total = pool.reduce((s, e) => s + e.w, 0)
  let r = Math.random() * total
  for (const entry of pool) {
    r -= entry.w
    if (r <= 0) return entry.fn()
  }
  return pool[0].fn()
}

export default function PumpkinRun() {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)
  const lastObstacleRef = useRef(0)
  const [screen, setScreen] = useState('idle')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem('pumpkin-best') || 0))

  const initState = () => ({
    dino: { y: GROUND_Y, vy: 0, ducking: false, legPhase: 0 },
    obstacles: [],
    score: 0,
    speed: 6,
    tick: 0,
    clouds: [
      { x: 200, y: 60 }, { x: 500, y: 40 }, { x: 700, y: 75 }
    ],
    groundOffset: 0,
  })

  const jump = useCallback(() => {
    if (screen === 'idle' || screen === 'dead') {
      stateRef.current = initState()
      lastObstacleRef.current = performance.now() + 800
      setScore(0)
      setScreen('playing')
      return
    }
    if (screen === 'playing') {
      const d = stateRef.current.dino
      if (d.y >= GROUND_Y && !d.ducking) {
        d.vy = JUMP_V
      }
    }
  }, [screen])

  const duck = useCallback((active) => {
    if (screen !== 'playing') return
    const d = stateRef.current.dino
    d.ducking = active
  }, [screen])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump() }
      if (e.code === 'ArrowDown') { e.preventDefault(); duck(true) }
    }
    const onKeyUp = (e) => {
      if (e.code === 'ArrowDown') duck(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [jump, duck])

  // Draw static screens
  useEffect(() => {
    if (screen === 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    drawScene(ctx, stateRef.current || initState())
    if (screen === 'idle') drawOverlay(ctx, '🐱  PUMPKIN RUN', 'PRESS SPACE OR TAP TO START')
    if (screen === 'dead') {
      drawOverlay(ctx, `SCORE: ${stateRef.current?.score ?? 0}`, 'PRESS SPACE OR TAP TO RETRY')
    }
  }, [screen])

  // Game loop
  useEffect(() => {
    if (screen !== 'playing') return

    const loop = (now) => {
      const s = stateRef.current
      if (!s) return

      s.tick++
      // Smooth linear ramp: starts at 6, adds ~0.035 per score point, caps at 16
      s.speed = Math.min(6 + s.score * 0.035, 16)

      // Spawn interval: eases from 2400ms down to 1100ms over ~130 score points
      const minInterval = Math.max(1100, 2400 - s.score * 10)
      if (now - lastObstacleRef.current > minInterval) {
        const spawned = spawnObstacles(s.score, s.speed, s.obstacles)
        for (const o of spawned) s.obstacles.push(o)
        lastObstacleRef.current = now
      }

      // Dino physics
      const d = s.dino
      d.vy += GRAVITY
      d.y = Math.min(d.y + d.vy, GROUND_Y)
      if (d.y >= GROUND_Y) { d.y = GROUND_Y; d.vy = 0 }

      // Advance leg phase proportional to speed (faster run = faster legs)
      if (d.y >= GROUND_Y && !d.ducking) {
        d.legPhase += s.speed * 0.07
      }

      // Dog leg animation
      for (const o of s.obstacles) {
        if (o.type === 'dog') {
          o.legTick++
          if (o.legTick % 8 === 0) o.legFrame = (o.legFrame + 1) % 2
        }
      }

      // Move obstacles & score
      for (const o of s.obstacles) o.x -= s.speed

      // Score: increment every ~6 frames
      if (s.tick % 6 === 0) {
        s.score++
        setScore(s.score)
      }

      s.obstacles = s.obstacles.filter((o) => o.x + o.w > 0)

      // Move clouds slowly
      for (const c of s.clouds) {
        c.x -= 0.5
        if (c.x < -120) c.x = W + 60
      }

      // Ground scroll
      s.groundOffset = (s.groundOffset + s.speed) % W

      // Collision
      const dinoH = d.ducking ? DUCK_H : DINO_H
      const dinoLeft = DINO_X + 8
      const dinoRight = DINO_X + DINO_W - 8
      const dinoTop = d.y - dinoH + 6
      const dinoBot = d.y - 4

      const dead = s.obstacles.some((o) => {
        const oRight = o.x + o.w - 4
        const oLeft = o.x + 4
        const oTop = o.type === 'yarn' ? GROUND_Y - o.h + 4 : o.y + 4
        const oBot = o.type === 'yarn' ? GROUND_Y - 4 : o.y + o.h - 4
        return dinoRight > oLeft && dinoLeft < oRight && dinoBot > oTop && dinoTop < oBot
      })

      if (dead) {
        if (s.score > best) {
          setBest(s.score)
          localStorage.setItem('pumpkin-best', s.score)
        }
        setScreen('dead')
        return
      }

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      drawScene(ctx, s)
      drawHUD(ctx, s.score, best)


      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [screen, best])

  return (
    <div className="pumpkin-wrapper">
      <nav className="pumpkin-nav">
        <Link to="/" className="pumpkin-back">← back</Link>
        <span className="pumpkin-title">Pumpkin Run</span>
        <span className="pumpkin-best">best: {best}</span>
      </nav>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="pumpkin-canvas"
        onClick={jump}
      />
      <p className="pumpkin-hint">SPACE / ↑ to jump &nbsp;·&nbsp; ↓ to duck &nbsp;·&nbsp; tap to play</p>
    </div>
  )
}

// ── Drawing ──────────────────────────────────────────────────────────────────

function drawScene(ctx, s) {
  // Background
  ctx.fillStyle = '#f7f3ef'
  ctx.fillRect(0, 0, W, H)

  // Clouds
  for (const c of s.clouds) drawCloud(ctx, c.x, c.y)

  // Ground line
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, GROUND_Y + 2)
  ctx.lineTo(W, GROUND_Y + 2)
  ctx.stroke()

  // Ground texture (dashes)
  ctx.fillStyle = '#bbb'
  const offset = s?.groundOffset ?? 0
  for (let x = -offset % 60; x < W; x += 60) {
    ctx.fillRect(x, GROUND_Y + 6, 30, 3)
    ctx.fillRect(x + 15, GROUND_Y + 12, 15, 2)
  }

  // Obstacles
  for (const o of s.obstacles) {
    if (o.type === 'yarn') drawYarn(ctx, o)
    else drawDog(ctx, o)
  }

  // Cat
  const d = s.dino
  drawCat(ctx, DINO_X, d.y, d.ducking, d.legPhase ?? 0, d.y < GROUND_Y)
}

function drawCloud(ctx, x, y) {
  ctx.fillStyle = '#e0dbd5'
  ctx.beginPath()
  ctx.ellipse(x, y, 40, 14, 0, 0, Math.PI * 2)
  ctx.ellipse(x + 20, y - 8, 24, 12, 0, 0, Math.PI * 2)
  ctx.ellipse(x - 16, y - 5, 18, 10, 0, 0, Math.PI * 2)
  ctx.fill()
}

// Cartoon leg: thick rounded thigh + shin + oval paw with toes
function drawLeg(ctx, hipX, hipY, swing, color, far = false) {
  const THIGH = 14
  const SHIN  = 12
  const alpha = far ? 0.55 : 1.0

  // Joint positions
  const kneeX = hipX + Math.sin(swing) * THIGH
  const kneeY = hipY + Math.cos(Math.abs(swing) * 0.35) * THIGH
  const shinAngle = swing * 0.5 + 0.25
  const pawX = kneeX + Math.sin(shinAngle) * SHIN
  const pawY = kneeY + Math.cos(shinAngle * 0.25) * SHIN

  ctx.save()
  ctx.globalAlpha = alpha

  // Thigh — thick rounded stroke
  ctx.strokeStyle = color
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(hipX, hipY)
  ctx.lineTo(kneeX, kneeY)
  ctx.stroke()

  // Knee joint dot
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(kneeX, kneeY, 4.5, 0, Math.PI * 2)
  ctx.fill()

  // Shin — slightly thinner
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(kneeX, kneeY)
  ctx.lineTo(pawX, pawY)
  ctx.stroke()

  // Paw — chunky oval
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(pawX, pawY + 3, 7, 5, Math.sin(swing) * 0.3, 0, Math.PI * 2)
  ctx.fill()

  // Toe bumps (3 small circles across the top of the paw)
  ctx.fillStyle = '#c07040'
  const toeSpread = 4
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.arc(pawX + i * toeSpread, pawY - 1, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawCat(ctx, x, groundY, ducking, legPhase, jumping) {
  const h = ducking ? DUCK_H : DINO_H
  const top = groundY - h

  if (ducking) {
    // ── Full flatten — belly to the ground, zooming under the dog ──
    const midY = groundY - 10   // body center close to ground
    const floorY = groundY - 2  // paw level

    // Tail — flat behind, low drag
    ctx.strokeStyle = '#e8a87c'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - 2, midY + 2)
    ctx.quadraticCurveTo(x - 20, midY + 6, x - 28, midY - 2)
    ctx.stroke()
    // Tail stripe rings
    ctx.strokeStyle = 'rgba(255,255,200,0.3)'
    ctx.lineWidth = 2
    ctx.setLineDash([3, 5])
    ctx.beginPath()
    ctx.moveTo(x - 2, midY + 2)
    ctx.quadraticCurveTo(x - 20, midY + 6, x - 28, midY - 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineCap = 'butt'

    // Body — wide flat ellipse, slight forward lean
    ctx.fillStyle = '#e8a87c'
    ctx.beginPath()
    ctx.ellipse(x + 22, midY, 32, 10, -0.12, 0, Math.PI * 2)
    ctx.fill()

    // Body tabby stripes clipped to body shape
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(x + 22, midY, 32, 10, -0.12, 0, Math.PI * 2)
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,200,0.35)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 4; i++) {
      const sx = x + 4 + i * 10
      ctx.beginPath()
      ctx.moveTo(sx, midY + 9)
      ctx.lineTo(sx + 1, midY - 9)
      ctx.stroke()
    }
    ctx.restore()

    // Belly stripe (tabby marking)
    ctx.fillStyle = '#d4865a'
    ctx.beginPath()
    ctx.ellipse(x + 18, midY + 4, 18, 4, -0.12, 0, Math.PI * 2)
    ctx.fill()

    // Head — thrust forward and low
    ctx.fillStyle = '#e8a87c'
    ctx.beginPath()
    ctx.ellipse(x + 52, midY - 2, 14, 11, 0.2, 0, Math.PI * 2)
    ctx.fill()

    // Head cheek stripe
    ctx.strokeStyle = 'rgba(255,255,200,0.35)'
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x + 56, midY + 3); ctx.lineTo(x + 62, midY + 1); ctx.stroke()

    // Ears pinned flat against head (low triangles pointing backward)
    ctx.fillStyle = '#d4865a'
    ctx.beginPath()
    ctx.moveTo(x + 42, midY - 10)
    ctx.lineTo(x + 38, midY - 3)
    ctx.lineTo(x + 50, midY - 5)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x + 50, midY - 11)
    ctx.lineTo(x + 46, midY - 4)
    ctx.lineTo(x + 57, midY - 7)
    ctx.fill()

    // Squinted eye — determined dash line
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + 56, midY - 4)
    ctx.quadraticCurveTo(x + 59, midY - 7, x + 63, midY - 4)
    ctx.stroke()

    // Nose
    ctx.fillStyle = '#c06060'
    ctx.beginPath()
    ctx.arc(x + 64, midY, 2, 0, Math.PI * 2)
    ctx.fill()

    // Whiskers angled back (streamlined)
    ctx.strokeStyle = '#ccc'
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x + 64, midY - 1); ctx.lineTo(x + 76, midY - 5); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x + 64, midY + 2); ctx.lineTo(x + 76, midY + 4); ctx.stroke()
    ctx.lineCap = 'butt'

    // Four stubby splayed paws on the ground
    ctx.fillStyle = '#d4865a'
    const pawY = floorY
    const paws = [x + 8, x + 18, x + 28, x + 38]
    for (const px of paws) {
      ctx.beginPath()
      ctx.ellipse(px, pawY, 6, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      // toe bumps
      ctx.fillStyle = '#c07040'
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.arc(px + i * 3, pawY - 3, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#d4865a'
    }
    return
  }

  // ── Running / jumping ──

  // Far legs drawn first (slightly darker, offset 3px back)
  const bodyBottom = groundY - 6
  const frontHipX = x + 24
  const backHipX  = x + 8
  const hipY = bodyBottom - 8

  if (jumping) {
    // Legs tucked up while airborne
    drawLeg(ctx, frontHipX - 2, hipY,  0.8, '#d4865a', true)
    drawLeg(ctx, backHipX  - 2, hipY, -0.8, '#d4865a', true)
    drawLeg(ctx, frontHipX,     hipY,  0.6, '#d4865a')
    drawLeg(ctx, backHipX,      hipY, -0.6, '#d4865a')
  } else {
    // Gallop: front and back pairs move in opposition
    const f  =  Math.sin(legPhase)              * 0.75
    const fF =  Math.sin(legPhase + Math.PI)    * 0.75
    const b  = -Math.sin(legPhase)              * 0.75
    const bF = -Math.sin(legPhase + Math.PI)    * 0.75
    drawLeg(ctx, frontHipX - 2, hipY, fF, '#d4865a', true)
    drawLeg(ctx, backHipX  - 2, hipY, bF, '#d4865a', true)
    drawLeg(ctx, frontHipX,     hipY, f,  '#d4865a')
    drawLeg(ctx, backHipX,      hipY, b,  '#d4865a')
  }

  // Tail (sways gently with pace) — base coat then stripe rings
  const tailSway = Math.sin(legPhase * 0.5) * 6
  ctx.strokeStyle = '#e8a87c'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x + 2, top + h - 10)
  ctx.quadraticCurveTo(x - 18, top + h - 28 + tailSway, x - 10, top + h - 46 + tailSway)
  ctx.stroke()
  // Tail stripe rings
  ctx.strokeStyle = 'rgba(255,255,200,0.3)'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 5])
  ctx.beginPath()
  ctx.moveTo(x + 2, top + h - 10)
  ctx.quadraticCurveTo(x - 18, top + h - 28 + tailSway, x - 10, top + h - 46 + tailSway)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineCap = 'butt'

  // Body
  ctx.fillStyle = '#e8a87c'
  ctx.beginPath()
  ctx.ellipse(x + 18, top + h - 22, 18, 20, 0, 0, Math.PI * 2)
  ctx.fill()

  // Body tabby stripes — three curved white lines across the flank
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(x + 18, top + h - 22, 18, 20, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,200,0.35)'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const sx = x + 6 + i * 7
    ctx.beginPath()
    ctx.moveTo(sx, top + h - 6)
    ctx.quadraticCurveTo(sx + 2, top + h - 22, sx - 1, top + h - 36)
    ctx.stroke()
  }
  ctx.restore()

  // Head
  ctx.fillStyle = '#e8a87c'
  ctx.beginPath()
  ctx.arc(x + 30, top + 16, 16, 0, Math.PI * 2)
  ctx.fill()

  // Forehead tabby M-mark (classic tabby)
  ctx.strokeStyle = 'rgba(255,255,200,0.35)'
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x + 24, top + 8); ctx.lineTo(x + 26, top + 3); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + 27, top + 7); ctx.lineTo(x + 29, top + 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + 30, top + 7); ctx.lineTo(x + 32, top + 2); ctx.stroke()

  // Cheek stripe
  ctx.beginPath(); ctx.moveTo(x + 36, top + 18); ctx.lineTo(x + 42, top + 16); ctx.stroke()

  // Ears
  ctx.fillStyle = '#d4865a'
  ctx.beginPath()
  ctx.moveTo(x + 20, top + 6)
  ctx.lineTo(x + 24, top - 8)
  ctx.lineTo(x + 32, top + 4)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + 30, top + 4)
  ctx.lineTo(x + 36, top - 8)
  ctx.lineTo(x + 44, top + 6)
  ctx.fill()
  // Inner ear highlight
  ctx.fillStyle = 'rgba(255,200,180,0.5)'
  ctx.beginPath()
  ctx.moveTo(x + 22, top + 5)
  ctx.lineTo(x + 25, top - 4)
  ctx.lineTo(x + 30, top + 3)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + 32, top + 3)
  ctx.lineTo(x + 36, top - 4)
  ctx.lineTo(x + 42, top + 5)
  ctx.fill()

  // Eye
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(x + 36, top + 14, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x + 37, top + 13, 1.2, 0, Math.PI * 2)
  ctx.fill()

  // Nose
  ctx.fillStyle = '#c06060'
  ctx.beginPath()
  ctx.arc(x + 39, top + 18, 2, 0, Math.PI * 2)
  ctx.fill()

  // Whiskers
  ctx.strokeStyle = '#ddd'
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x + 40, top + 18); ctx.lineTo(x + 54, top + 15); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + 40, top + 20); ctx.lineTo(x + 54, top + 22); ctx.stroke()
}

function drawYarn(ctx, o) {
  const base = GROUND_Y
  const drawBall = (cx, cy, r, color) => {
    // Ball
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    // Yarn cross lines
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.7, cy - r * 0.7)
    ctx.quadraticCurveTo(cx + r * 0.3, cy, cx - r * 0.7, cy + r * 0.7)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + r * 0.7, cy - r * 0.7)
    ctx.quadraticCurveTo(cx - r * 0.3, cy, cx + r * 0.7, cy + r * 0.7)
    ctx.stroke()
    // Loose thread
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx + r * 0.6, cy - r * 0.8)
    ctx.quadraticCurveTo(cx + r + 6, cy - r - 8, cx + r + 2, cy - r - 18)
    ctx.stroke()
  }

  const r = o.h / 2
  const cy = base - r
  const colors = ['#e05c8a', '#5c9ee0', '#e0a020']
  const color = colors[(Math.round(o.x / 80)) % colors.length]

  if (o.double) {
    drawBall(o.x + r, cy, r, color)
    drawBall(o.x + r * 3 + 6, cy, r, colors[(Math.round(o.x / 80) + 1) % colors.length])
  } else {
    drawBall(o.x + r, cy, r, color)
  }
}

function drawDog(ctx, o) {
  const { x, y, legFrame } = o

  // Body — lean forward leap pose
  ctx.fillStyle = '#a07840'
  ctx.beginPath()
  ctx.ellipse(x + 22, y + 20, 24, 14, 0, 0, Math.PI * 2)
  ctx.fill()

  // Head
  ctx.beginPath()
  ctx.arc(x + 42, y + 14, 14, 0, Math.PI * 2)
  ctx.fill()

  // Floppy ear
  ctx.fillStyle = '#7a5820'
  ctx.beginPath()
  ctx.ellipse(x + 34, y + 18, 7, 12, -0.4, 0, Math.PI * 2)
  ctx.fill()

  // Snout
  ctx.fillStyle = '#c09060'
  ctx.beginPath()
  ctx.ellipse(x + 53, y + 17, 8, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // Nose
  ctx.fillStyle = '#333'
  ctx.beginPath()
  ctx.arc(x + 57, y + 14, 3, 0, Math.PI * 2)
  ctx.fill()

  // Eye
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(x + 46, y + 10, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x + 47, y + 9, 1, 0, Math.PI * 2)
  ctx.fill()

  // Tail wag
  ctx.strokeStyle = '#a07840'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  const wagAngle = legFrame === 0 ? -0.6 : 0.6
  ctx.beginPath()
  ctx.moveTo(x, y + 16)
  ctx.quadraticCurveTo(x - 12, y + 10 + wagAngle * 10, x - 14, y + 2 + wagAngle * 18)
  ctx.stroke()
  ctx.lineCap = 'butt'

  // Legs tucked in leap pose
  ctx.fillStyle = '#7a5820'
  if (legFrame === 0) {
    ctx.beginPath()
    ctx.ellipse(x + 30, y + 28, 10, 5, 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x + 8, y + 26, 9, 5, -0.4, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.ellipse(x + 28, y + 29, 10, 5, 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x + 10, y + 27, 9, 5, -0.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHUD(ctx, score, best) {
  ctx.fillStyle = '#888'
  ctx.font = '16px "Courier New"'
  ctx.textAlign = 'left'
  ctx.fillText(`HI ${String(best).padStart(5, '0')}  ${String(score).padStart(5, '0')}`, W - 220, 28)
}

function drawOverlay(ctx, line1, line2) {
  ctx.fillStyle = 'rgba(247,243,239,0.82)'
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'

  if (line1) {
    ctx.fillStyle = '#333'
    ctx.font = 'bold 28px "Courier New"'
    ctx.fillText(line1, W / 2, H / 2 - 18)
  }

  ctx.fillStyle = '#555'
  ctx.font = '15px "Courier New"'
  ctx.fillText(line2, W / 2, H / 2 + (line1 ? 20 : 0))
}
