import { useEffect, useRef, useState } from 'react'
import { getMotion, type MotionLevel } from '../lib/appearance'

/**
 * Pointer candy layered over everything (pointer-events: none, so it never eats a click):
 *  - lively: a soft spotlight that trails the cursor, and a ripple ring on every click
 *  - crazy:  all of that plus a spark burst per click and a comet trail while moving
 * Also listens for the Konami code (↑↑↓↓←→←→BA) → 8 seconds of party mode with confetti.
 */
export function CursorFx() {
  const [motion, setMotion] = useState<MotionLevel>(getMotion)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const on = () => setMotion(getMotion())
    window.addEventListener('devtools:appearance', on)
    return () => window.removeEventListener('devtools:appearance', on)
  }, [])

  useEffect(() => {
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
    let pos = 0
    function onKey(e: KeyboardEvent) {
      pos = e.key === seq[pos] || e.key.toLowerCase() === seq[pos] ? pos + 1 : e.key === seq[0] ? 1 : 0
      if (pos === seq.length) {
        pos = 0
        window.dispatchEvent(new CustomEvent('devtools:party'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (motion === 'off' || motion === 'calm') return
    const canvas = canvasRef.current
    const spot = spotRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const crazy = motion === 'crazy'
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; ring?: boolean }
    let sparks: Spark[] = []
    let raf = 0
    let running = false
    let partyUntil = 0

    function size() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    size()

    function colors() {
      const s = getComputedStyle(document.documentElement)
      return ['--cyan', '--rose', '--violet', '--warm', '--emerald'].map((v) => s.getPropertyValue(v).trim() || '#fff')
    }
    let palette = colors()

    function kick() {
      if (!running) {
        running = true
        raf = requestAnimationFrame(loop)
      }
    }

    function loop() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      sparks = sparks.filter((s) => s.life < s.max)
      for (const s of sparks) {
        s.life++
        const k = 1 - s.life / s.max
        if (s.ring) {
          ctx!.globalAlpha = k * 0.7
          ctx!.strokeStyle = s.color
          ctx!.lineWidth = 2
          ctx!.beginPath()
          ctx!.arc(s.x, s.y, (1 - k) * s.size, 0, Math.PI * 2)
          ctx!.stroke()
          continue
        }
        s.x += s.vx
        s.y += s.vy
        s.vy += 0.12
        s.vx *= 0.985
        ctx!.globalAlpha = k
        ctx!.fillStyle = s.color
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.size * k + 0.5, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
      if (Date.now() < partyUntil && Math.random() < 0.6) confetti(Math.random() * canvas!.width, -10, 3)
      if (sparks.length > 0 || Date.now() < partyUntil) raf = requestAnimationFrame(loop)
      else running = false
    }

    function burst(x: number, y: number, n: number) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const v = 2 + Math.random() * 4.5
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 0, max: 38 + Math.random() * 24, color: palette[i % palette.length], size: 2 + Math.random() * 2.5 })
      }
    }
    function confetti(x: number, y: number, n: number) {
      for (let i = 0; i < n; i++) {
        sparks.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, life: 0, max: 160, color: palette[Math.floor(Math.random() * palette.length)], size: 3 + Math.random() * 3 })
      }
    }

    let lastTrail = 0
    function onMove(e: PointerEvent) {
      if (spot) spot.style.transform = `translate3d(${e.clientX - 300}px, ${e.clientY - 300}px, 0)`
      if (crazy && e.pointerType === 'mouse') {
        const now = performance.now()
        if (now - lastTrail > 22) {
          lastTrail = now
          sparks.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 - 0.2, life: 0, max: 26, color: palette[Math.floor(now / 90) % palette.length], size: 2.4 })
          kick()
        }
      }
    }
    function onDown(e: PointerEvent) {
      sparks.push({ x: e.clientX, y: e.clientY, vx: 0, vy: 0, life: 0, max: 28, color: palette[0], size: 46, ring: true })
      if (crazy) burst(e.clientX, e.clientY, 18)
      kick()
    }
    function onCelebrate() {
      partyUntil = Date.now() + 2500
      for (let i = 0; i < 4; i++) burst(Math.random() * canvas!.width, Math.random() * canvas!.height * 0.5, 22)
      kick()
    }
    function onParty() {
      partyUntil = Date.now() + 8000
      document.documentElement.classList.add('party-mode')
      setTimeout(() => document.documentElement.classList.remove('party-mode'), 8000)
      for (let i = 0; i < 6; i++) burst(Math.random() * canvas!.width, Math.random() * canvas!.height * 0.6, 24)
      kick()
    }
    const onTheme = () => (palette = colors())

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('resize', size)
    window.addEventListener('devtools:party', onParty)
    window.addEventListener('devtools:themechange', onTheme)
    window.addEventListener('devtools:celebrate', onCelebrate)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', size)
      window.removeEventListener('devtools:party', onParty)
      window.removeEventListener('devtools:themechange', onTheme)
      window.removeEventListener('devtools:celebrate', onCelebrate)
    }
  }, [motion])

  if (motion === 'off' || motion === 'calm') return null
  return (
    <>
      <div ref={spotRef} className="cursor-spot" aria-hidden="true" />
      <canvas ref={canvasRef} className="cursor-canvas" aria-hidden="true" />
    </>
  )
}

/** Fire a confetti celebration from anywhere (e.g. a pipeline that just went green). */
export function celebrate() {
  window.dispatchEvent(new CustomEvent('devtools:celebrate'))
}
