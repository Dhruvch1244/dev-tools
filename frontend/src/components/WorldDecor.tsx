import { useMemo } from 'react'
import type { FxKind } from '../lib/themes'

/**
 * Extra scenery layered on top of each world's main animated backdrop, so every theme has
 * several things going on: twinkling stars, shooting stars, silhouettes (mountains, palms,
 * trees, seaweed, a blossom branch, a city skyline), drifting glyphs, a moon, a planet,
 * caustics, marching pixel bugs, a pulsing dance floor… All CSS/SVG, all pointer-events:none,
 * and all frozen by Appearance → Motion → Off (the global animation kill-switch).
 */

// deterministic pseudo-random so scenery doesn't reshuffle on every render
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function Stars({ n, seed = 7, maxTop = 70, color = 'var(--ink)' }: { n: number; seed?: number; maxTop?: number; color?: string }) {
  const stars = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: n }, () => ({ x: r() * 100, y: r() * maxTop, s: 1 + r() * 2.2, d: r() * 6, t: 2.5 + r() * 4 }))
  }, [n, seed, maxTop])
  return (
    <div className="wd-layer">
      {stars.map((s, i) => (
        <span key={i} className="wd-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, background: color, animationDelay: `-${s.d}s`, animationDuration: `${s.t}s` }} />
      ))}
    </div>
  )
}

function ShootingStars({ n = 3, color = '#fff' }: { n?: number; color?: string }) {
  return (
    <div className="wd-layer">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="wd-shoot" style={{ top: `${8 + i * 17}%`, left: `${20 + i * 23}%`, animationDelay: `${i * 3.7}s`, ['--c' as string]: color }} />
      ))}
    </div>
  )
}

function Floaters({ items, n, seed = 3, className = '' }: { items: string[]; n: number; seed?: number; className?: string }) {
  const list = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: n }, (_, i) => ({ ch: items[i % items.length], x: r() * 96, d: r() * 30, t: 22 + r() * 26, s: 0.9 + r() * 1.6, rot: r() * 360 }))
  }, [items, n, seed])
  return (
    <div className="wd-layer">
      {list.map((f, i) => (
        <span key={i} className={`wd-float ${className}`} style={{ left: `${f.x}%`, fontSize: `${f.s}rem`, animationDelay: `-${f.d}s`, animationDuration: `${f.t}s`, ['--r' as string]: `${f.rot}deg` }}>
          {f.ch}
        </span>
      ))}
    </div>
  )
}

function ridge(seed: number, base: number, amp: number, steps: number) {
  const r = rng(seed)
  let d = `M0 100 L0 ${base}`
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * 100
    d += ` L${x.toFixed(1)} ${(base - r() * amp).toFixed(1)}`
  }
  return d + ' L100 100 Z'
}

function Mountains({ tint = 'var(--void)', seed = 11, layers = 2 }: { tint?: string; seed?: number; layers?: number }) {
  return (
    <svg className="wd-bottom" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: '34vh' }}>
      {Array.from({ length: layers }, (_, i) => (
        <path key={i} d={ridge(seed + i * 5, 70 + i * 12, 38 - i * 10, 14 + i * 6)} fill={tint} opacity={0.55 + i * 0.3} />
      ))}
    </svg>
  )
}

function Skyline() {
  const blocks = useMemo(() => {
    const r = rng(42)
    let x = 0
    const out: { x: number; w: number; h: number; lit: number[] }[] = []
    while (x < 100) {
      const w = 2.5 + r() * 5
      out.push({ x, w, h: 20 + r() * 60, lit: Array.from({ length: 6 }, () => r()) })
      x += w + 0.4
    }
    return out
  }, [])
  return (
    <svg className="wd-bottom" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: '30vh' }}>
      {blocks.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={100 - b.h} width={b.w} height={b.h} fill="var(--void)" opacity={0.92} />
          {b.lit.map((l, j) => l > 0.55 && <rect key={j} className="wd-window" x={b.x + 0.6 + (j % 2) * (b.w / 2 - 0.4)} y={100 - b.h + 4 + Math.floor(j / 2) * 7} width={0.9} height={2.2} fill={j % 3 ? 'var(--warm)' : 'var(--cyan)'} style={{ animationDelay: `-${l * 9}s` }} />)}
        </g>
      ))}
    </svg>
  )
}

function Palms() {
  const palm = (x: number, flip: boolean, scale: number) => (
    <g transform={`translate(${x} 100) scale(${flip ? -scale : scale} ${scale})`} className="wd-sway">
      <path d="M0 0 C 2 -20, 4 -40, 1 -62" stroke="var(--void)" strokeWidth="2.4" fill="none" />
      {[-70, -35, 0, 35, 70, 110, -110].map((a, i) => (
        <path key={i} d="M1 -62 C 8 -66, 16 -64, 24 -58 C 16 -60, 8 -60, 1 -62 Z" fill="var(--void)" transform={`rotate(${a} 1 -62)`} />
      ))}
    </g>
  )
  return (
    <svg className="wd-bottom" viewBox="0 0 200 100" preserveAspectRatio="xMidYMax slice" style={{ height: '46vh' }}>
      {palm(14, false, 1.1)}
      {palm(30, true, 0.8)}
      {palm(186, true, 1.15)}
      {palm(170, false, 0.75)}
    </svg>
  )
}

function Trees() {
  const trees = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 16 }, (_, i) => ({ x: i * 6.6 + r() * 3, h: 40 + r() * 45, w: 5 + r() * 4 }))
  }, [])
  return (
    <svg className="wd-bottom" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: '38vh' }}>
      {trees.map((t, i) => (
        <path key={i} d={`M${t.x} 100 L${t.x + t.w / 2} ${100 - t.h} L${t.x + t.w} 100 Z`} fill="var(--void)" opacity={i % 2 ? 0.95 : 0.75} />
      ))}
    </svg>
  )
}

function Seaweed() {
  const fronds = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 22 }, () => ({ x: r() * 100, h: 18 + r() * 40, d: r() * 5 }))
  }, [])
  return (
    <svg className="wd-bottom" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: '36vh' }}>
      {fronds.map((f, i) => (
        <path key={i} className="wd-sway" style={{ animationDelay: `-${f.d}s`, transformOrigin: `${f.x}% 100%` }} d={`M${f.x} 100 Q ${f.x - 3} ${100 - f.h / 2}, ${f.x + 1} ${100 - f.h}`} stroke="var(--emerald)" strokeOpacity={0.35} strokeWidth="1.1" fill="none" />
      ))}
    </svg>
  )
}

function Branch() {
  return (
    <svg className="wd-corner" viewBox="0 0 300 200" style={{ width: "min(30vw, 380px)", opacity: 0.55, top: "4.5rem" }}>
      <path d="M300 10 C 230 30, 180 60, 120 70 C 90 75, 60 95, 20 120" stroke="#6b3a4a" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M200 45 C 190 75, 170 95, 150 110" stroke="#6b3a4a" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.5" />
      {[[120, 70], [150, 110], [60, 98], [200, 45], [240, 28], [95, 80], [170, 92], [30, 115], [270, 18]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} className="wd-bloom" style={{ animationDelay: `-${i * 0.7}s` }}>
          {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-6" rx="4.2" ry="6.5" fill="#f9b8cf" opacity="0.85" transform={`rotate(${a})`} />)}
          <circle r="2.2" fill="#e85d8f" />
        </g>
      ))}
    </svg>
  )
}

function Bugs() {
  // an original 8×6 pixel "code bug" sprite — marches across the top of the arcade world
  const px = ['..X..X..', '...XX...', '.XXXXXX.', 'XX.XX.XX', '.XXXXXX.', 'X.X..X.X']
  return (
    <div className="wd-layer">
      <div className="wd-march">
        {Array.from({ length: 7 }, (_, k) => (
          <svg key={k} viewBox="0 0 8 6" className="wd-bug" style={{ animationDelay: `${k * 0.12}s` }}>
            {px.flatMap((row, y) => row.split('').map((c, x) => (c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={k % 2 ? 'var(--rose)' : 'var(--cyan)'} /> : null)))}
          </svg>
        ))}
      </div>
    </div>
  )
}

export function WorldDecor({ fx }: { fx: FxKind }) {
  switch (fx) {
    case 'constellation':
      return (
        <>
          <ShootingStars n={3} color="var(--cyan)" />
          <Floaters items={['∑', '∫', 'λ', '∞', 'O(n)', '{ }', '→', 'Δ', '∂', 'π', '≠', '⊕']} n={14} className="wd-glyph" />
        </>
      )
    case 'synthwave':
      return (
        <>
          <Stars n={70} maxTop={45} />
          <ShootingStars n={2} color="#ff7ad9" />
          <div className="wd-horizon" />
          <Palms />
        </>
      )
    case 'matrix':
      return <div className="wd-crt" />
    case 'aurora':
      return (
        <>
          <Stars n={90} maxTop={60} />
          <ShootingStars n={2} />
          <Mountains seed={3} layers={2} />
        </>
      )
    case 'cyber':
      return (
        <>
          <Skyline />
          <div className="wd-glitchbar" />
          <Floaters items={['ｼｽﾃﾑ', '404', 'NEON', '0xDEAD', 'SYNC', '∆t']} n={8} seed={21} className="wd-neon" />
        </>
      )
    case 'lava':
      return (
        <>
          <Floaters items={['●']} n={26} seed={8} className="wd-rise" />
          <div className="wd-heat" />
        </>
      )
    case 'ocean':
      return (
        <>
          <div className="wd-caustics" />
          <Floaters items={['🐟', '🐠', '🪼']} n={7} seed={13} className="wd-swim" />
          <Seaweed />
        </>
      )
    case 'warp':
      return (
        <>
          <div className="wd-nebula" />
          <div className="wd-planet" />
        </>
      )
    case 'fireflies':
      return (
        <>
          <Stars n={50} maxTop={40} color="#fff7d0" />
          <div className="wd-moon" />
          <div className="wd-fog" />
          <Trees />
        </>
      )
    case 'arcade':
      return (
        <>
          <Bugs />
          <div className="wd-pixelfloor" />
        </>
      )
    case 'disco':
      return (
        <>
          <div className="wd-dancefloor">{Array.from({ length: 48 }, (_, i) => <span key={i} style={{ animationDelay: `-${(i * 0.37) % 3}s` }} />)}</div>
          <Floaters items={['✦', '✧', '★', '♪', '♫']} n={18} seed={17} className="wd-sparkle" />
        </>
      )
    case 'snow':
      return (
        <>
          <Stars n={40} maxTop={40} />
          <div className="wd-aurora-soft" />
          <Mountains seed={19} layers={3} tint="#e8f1fb" />
        </>
      )
    case 'petals':
      return (
        <>
          <div className="wd-sun" />
          <Branch />
        </>
      )
    case 'blobs':
      return <Floaters items={['✿', '◆', '●', '▲', '✶', '♥', '〰']} n={20} seed={31} className="wd-pop" />
    default:
      return null
  }
}
