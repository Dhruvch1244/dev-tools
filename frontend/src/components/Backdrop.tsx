import { useEffect, useRef, useState } from 'react'
import type { FxKind } from '../lib/themes'
import { getCurrentFx } from '../lib/themes'
import { getMotion, motionFactor, type MotionLevel } from '../lib/appearance'

/**
 * The animated "world" behind the app. Canvas particle scenes for the busy ones (constellation,
 * code rain, warp stars, fireflies, petals, snow, bubbles, pixel stars), pure CSS for the rest
 * (synthwave grid, aurora ribbons, cyber grid, lava blobs, disco beams). Pauses when the tab is
 * hidden, scales particle counts with the motion level, and paints one still frame on "Off".
 */
export function Backdrop() {
  const [fx, setFx] = useState<FxKind>(getCurrentFx)
  const [motion, setMotion] = useState<MotionLevel>(getMotion)

  useEffect(() => {
    const onTheme = () => setFx(getCurrentFx())
    const onAppearance = () => setMotion(getMotion())
    window.addEventListener('devtools:themechange', onTheme)
    window.addEventListener('devtools:appearance', onAppearance)
    return () => {
      window.removeEventListener('devtools:themechange', onTheme)
      window.removeEventListener('devtools:appearance', onAppearance)
    }
  }, [])

  const canvasKinds: FxKind[] = ['constellation', 'matrix', 'warp', 'fireflies', 'arcade', 'petals', 'snow', 'ocean']
  return (
    <div className="fx-root" aria-hidden="true" data-fx={fx}>
      {fx === 'glow' && <div className="bg-glow" />}
      {fx === 'synthwave' && (
        <div className="fx-synth">
          <div className="fx-synth-sun" />
          <div className="fx-synth-grid" />
        </div>
      )}
      {fx === 'aurora' && (
        <div className="fx-aurora">
          <span /><span /><span /><span />
        </div>
      )}
      {fx === 'cyber' && (
        <div className="fx-cyber">
          <div className="fx-cyber-grid" />
          <div className="fx-cyber-scan" />
        </div>
      )}
      {(fx === 'lava' || fx === 'blobs') && (
        <div className={fx === 'lava' ? 'fx-lava' : 'fx-blobs'}>
          <span /><span /><span /><span /><span />
        </div>
      )}
      {fx === 'disco' && (
        <div className="fx-disco">
          <div className="fx-disco-beams" />
          <div className="fx-disco-ball" />
        </div>
      )}
      {fx === 'ocean' && <div className="fx-ocean-rays" />}
      {canvasKinds.includes(fx) && <ParticleCanvas kind={fx} motion={motion} key={fx} />}
      {(fx === 'matrix' || fx === 'arcade' || fx === 'cyber') && <div className="fx-scanlines" />}
    </div>
  )
}

type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; t: number; c: number; s?: string }

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2fe6f2'
}

function ParticleCanvas({ kind, motion }: { kind: FxKind; motion: MotionLevel }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const factor = motionFactor(motion)
    const still = factor === 0
    const speed = still ? 0 : Math.max(0.35, factor)
    let w = 0
    let h = 0
    let raf = 0
    let last = performance.now()
    let palette: string[] = []
    let ps: P[] = []
    let columns: number[] = []
    const mouse = { x: -9999, y: -9999 }
    const GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>/{}[]=+*#$'

    function readPalette() {
      palette = [cssVar('--cyan'), cssVar('--violet'), cssVar('--rose'), cssVar('--warm'), cssVar('--emerald')]
    }

    const density = Math.max(0.5, factor || 0.6)
    function count(base: number) {
      return Math.round(base * density * Math.min(1.6, (w * h) / (1440 * 900)))
    }

    function spawn(i: number): P {
      const rnd = Math.random
      switch (kind) {
        case 'constellation':
          return { x: rnd() * w, y: rnd() * h, vx: (rnd() - 0.5) * 0.25, vy: (rnd() - 0.5) * 0.25, r: 1 + rnd() * 1.6, a: 0.4 + rnd() * 0.6, t: rnd() * 6, c: i % 5 }
        case 'warp':
          return { x: (rnd() - 0.5) * w, y: (rnd() - 0.5) * h, vx: 0, vy: 0, r: rnd() * w, a: 1, t: 0, c: i % 5 }
        case 'fireflies':
          return { x: rnd() * w, y: rnd() * h, vx: (rnd() - 0.5) * 0.4, vy: (rnd() - 0.5) * 0.4, r: 1.5 + rnd() * 2.5, a: rnd(), t: rnd() * 10, c: 3 }
        case 'arcade':
          return { x: rnd() * w, y: rnd() * h, vx: 0, vy: 0.3 + rnd() * 1.6, r: rnd() < 0.15 ? 3 : 2, a: 0.4 + rnd() * 0.6, t: 0, c: i % 5 }
        case 'petals':
          return { x: rnd() * w, y: -20 - rnd() * h, vx: 0.3 + rnd() * 0.6, vy: 0.5 + rnd() * 0.9, r: 5 + rnd() * 6, a: rnd() * Math.PI * 2, t: rnd() * 10, c: 2 }
        case 'snow':
          return { x: rnd() * w, y: -10 - rnd() * h, vx: (rnd() - 0.5) * 0.3, vy: 0.4 + rnd() * 1.1, r: 1 + rnd() * 2.6, a: 0.4 + rnd() * 0.6, t: rnd() * 10, c: 0 }
        case 'ocean':
          return { x: rnd() * w, y: h + rnd() * h, vx: 0, vy: -(0.4 + rnd() * 1.2), r: 2 + rnd() * 7, a: 0.15 + rnd() * 0.4, t: rnd() * 10, c: i % 2 === 0 ? 0 : 4 }
        default:
          return { x: rnd() * w, y: rnd() * h, vx: 0, vy: 0, r: 1, a: 1, t: 0, c: 0 }
      }
    }

    function init() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      canvas!.style.width = `${w}px`
      canvas!.style.height = `${h}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      readPalette()
      const n = { constellation: 90, warp: 260, fireflies: 60, arcade: 150, petals: 38, snow: 140, ocean: 55 }[kind as string] ?? 0
      ps = Array.from({ length: count(n) }, (_, i) => spawn(i))
      if (kind === 'warp') ps.forEach((p) => (p.r = Math.random() * w))
      if (kind === 'matrix') columns = Array.from({ length: Math.ceil(w / 18) }, () => Math.random() * -h)
    }

    function frame(now: number) {
      const dt = Math.min(48, now - last) / 16.67
      last = now
      const step = dt * speed
      switch (kind) {
        case 'constellation': {
          ctx!.clearRect(0, 0, w, h)
          const maxD = 150
          for (const p of ps) {
            p.x += p.vx * step
            p.y += p.vy * step
            if (p.x < 0 || p.x > w) p.vx *= -1
            if (p.y < 0 || p.y > h) p.vy *= -1
            const dx = p.x - mouse.x
            const dy = p.y - mouse.y
            const md = Math.hypot(dx, dy)
            if (md < 140 && md > 0 && !still) {
              p.x += (dx / md) * 0.9 * step
              p.y += (dy / md) * 0.9 * step
            }
          }
          ctx!.lineWidth = 0.7
          for (let i = 0; i < ps.length; i++) {
            for (let j = i + 1; j < ps.length; j++) {
              const a = ps[i]
              const b = ps[j]
              const d = Math.hypot(a.x - b.x, a.y - b.y)
              if (d < maxD) {
                ctx!.globalAlpha = (1 - d / maxD) * 0.35
                ctx!.strokeStyle = palette[a.c % 2 === 0 ? 0 : 1]
                ctx!.beginPath()
                ctx!.moveTo(a.x, a.y)
                ctx!.lineTo(b.x, b.y)
                ctx!.stroke()
              }
            }
          }
          for (const p of ps) {
            p.t += 0.03 * step
            ctx!.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.t))
            ctx!.fillStyle = palette[p.c]
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
            ctx!.fill()
          }
          break
        }
        case 'matrix': {
          ctx!.globalAlpha = still ? 1 : 0.09 * Math.max(0.6, dt)
          ctx!.fillStyle = cssVar('--void')
          ctx!.fillRect(0, 0, w, h)
          ctx!.font = '15px "JetBrains Mono", monospace'
          for (let i = 0; i < columns.length; i++) {
            const y = columns[i]
            const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
            ctx!.globalAlpha = 0.85
            ctx!.fillStyle = Math.random() < 0.04 ? '#e8ffe8' : palette[0]
            ctx!.fillText(ch, i * 18, y)
            columns[i] = y > h + Math.random() * 4000 ? 0 : y + 17 * (still ? 40 : step * 0.55)
          }
          break
        }
        case 'warp': {
          ctx!.globalAlpha = 0.35
          ctx!.fillStyle = cssVar('--void')
          ctx!.fillRect(0, 0, w, h)
          const cx = w / 2
          const cy = h / 2
          for (const p of ps) {
            const pz = p.r
            p.r -= 6 * step
            if (p.r < 1) {
              Object.assign(p, spawn(p.c))
              p.r = w
              continue
            }
            const sx = cx + (p.x / p.r) * w * 0.5
            const sy = cy + (p.y / p.r) * h * 0.5
            const px = cx + (p.x / pz) * w * 0.5
            const py = cy + (p.y / pz) * h * 0.5
            const size = Math.max(0.4, (1 - p.r / w) * 2.6)
            ctx!.globalAlpha = Math.min(1, (1 - p.r / w) * 1.4)
            ctx!.strokeStyle = p.c === 0 ? '#ffffff' : palette[p.c]
            ctx!.lineWidth = size
            ctx!.beginPath()
            ctx!.moveTo(px, py)
            ctx!.lineTo(sx, sy)
            ctx!.stroke()
          }
          break
        }
        case 'fireflies': {
          ctx!.clearRect(0, 0, w, h)
          for (const p of ps) {
            p.t += 0.02 * step
            p.vx += (Math.random() - 0.5) * 0.05 * step
            p.vy += (Math.random() - 0.5) * 0.05 * step
            p.vx = Math.max(-0.6, Math.min(0.6, p.vx))
            p.vy = Math.max(-0.6, Math.min(0.6, p.vy))
            p.x = (p.x + p.vx * step + w) % w
            p.y = (p.y + p.vy * step + h) % h
            const glow = 0.5 + 0.5 * Math.sin(p.t * 2.2)
            const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6)
            g.addColorStop(0, palette[3])
            g.addColorStop(1, 'transparent')
            ctx!.globalAlpha = glow * 0.7
            ctx!.fillStyle = g
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.globalAlpha = glow
            ctx!.fillStyle = '#fffbe0'
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2)
            ctx!.fill()
          }
          break
        }
        case 'arcade': {
          ctx!.clearRect(0, 0, w, h)
          for (const p of ps) {
            p.y += p.vy * step
            if (p.y > h) {
              p.y = -4
              p.x = Math.random() * w
            }
            ctx!.globalAlpha = p.a
            ctx!.fillStyle = palette[p.c]
            ctx!.fillRect(Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3, p.r, p.r)
          }
          break
        }
        case 'petals': {
          ctx!.clearRect(0, 0, w, h)
          for (const p of ps) {
            p.t += 0.02 * step
            p.x += (p.vx + Math.sin(p.t) * 0.6) * step
            p.y += p.vy * step
            p.a += 0.02 * step
            if (p.y > h + 20 || p.x > w + 20) Object.assign(p, spawn(0), { y: -20, x: Math.random() * w * 0.9 })
            ctx!.save()
            ctx!.translate(p.x, p.y)
            ctx!.rotate(p.a)
            ctx!.globalAlpha = 0.55
            ctx!.fillStyle = '#f8a5c2'
            ctx!.beginPath()
            ctx!.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.globalAlpha = 0.35
            ctx!.fillStyle = '#ffd6e5'
            ctx!.beginPath()
            ctx!.ellipse(-p.r * 0.25, 0, p.r * 0.4, p.r * 0.22, 0, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.restore()
          }
          break
        }
        case 'snow': {
          ctx!.clearRect(0, 0, w, h)
          ctx!.fillStyle = '#ffffff'
          for (const p of ps) {
            p.t += 0.01 * step
            p.x += (p.vx + Math.sin(p.t) * 0.3) * step
            p.y += p.vy * step
            if (p.y > h + 5) Object.assign(p, spawn(0), { y: -5 })
            ctx!.globalAlpha = p.a * 0.8
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
            ctx!.fill()
          }
          break
        }
        case 'ocean': {
          ctx!.clearRect(0, 0, w, h)
          ctx!.lineWidth = 1.2
          for (const p of ps) {
            p.t += 0.03 * step
            p.y += p.vy * step
            p.x += Math.sin(p.t) * 0.4 * step
            if (p.y < -20) Object.assign(p, spawn(p.c), { y: h + 10 })
            ctx!.globalAlpha = p.a
            ctx!.strokeStyle = palette[p.c]
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
            ctx!.stroke()
            ctx!.globalAlpha = p.a * 0.8
            ctx!.fillStyle = '#ffffff'
            ctx!.beginPath()
            ctx!.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.18, 0, Math.PI * 2)
            ctx!.fill()
          }
          break
        }
      }
      ctx!.globalAlpha = 1
      if (!still && !document.hidden) raf = requestAnimationFrame(frame)
    }

    init()
    if (still) {
      // a single settled frame: run a handful of steps so the scene isn't all spawn-points
      for (let i = 0; i < (kind === 'matrix' ? 30 : 1); i++) frame(performance.now())
    } else raf = requestAnimationFrame(frame)

    const onResize = () => {
      cancelAnimationFrame(raf)
      init()
      if (!still) raf = requestAnimationFrame(frame)
      else frame(performance.now())
    }
    const onVis = () => {
      if (!document.hidden && !still) {
        last = performance.now()
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(frame)
      }
    }
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    const onTheme = () => readPalette()
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('devtools:themechange', onTheme)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('devtools:themechange', onTheme)
    }
  }, [kind, motion])

  return <canvas ref={ref} className="fx-canvas" />
}
