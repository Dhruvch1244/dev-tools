import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { ArrowRight, CheckCircle, HandPalm, MagnifyingGlass, Rocket, Sparkle, Star, Tag } from '@phosphor-icons/react'
import { GROUPS, type Tool, type ToolDef } from '../App'
import { SectionLabel } from '../components/ui'
import { WORLD_THEMES, applyTheme, getStoredTheme } from '../lib/themes'
import { getMotion } from '../lib/appearance'

const TAGLINES = [
  'Ship the pipeline.',
  'Proceed to PROD.',
  'Grab the helm tag.',
  'Rehydrate any env.',
  'Diff anything.',
  'Lint the Dockerfile.',
  'Find the deadlock.',
  'Query the JSON.',
  'Stay offline. Stay fast.',
]

function useTypewriter(lines: string[]) {
  const [i, setI] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const full = lines[i % lines.length]
    const done = !deleting && text === full
    const empty = deleting && text === ''
    const t = setTimeout(
      () => {
        if (done) setDeleting(true)
        else if (empty) {
          setDeleting(false)
          setI((x) => x + 1)
        } else setText(deleting ? full.slice(0, text.length - 1) : full.slice(0, text.length + 1))
      },
      done ? 1600 : empty ? 250 : deleting ? 28 : 60,
    )
    return () => clearTimeout(t)
  }, [text, deleting, i, lines])
  return text
}

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const v = useMotionValue(0)
  const rounded = useTransform(v, (x) => Math.round(x).toLocaleString() + suffix)
  useEffect(() => {
    const c = animate(v, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1] })
    return () => c.stop()
  }, [to, v])
  return <motion.span>{rounded}</motion.span>
}

export function HomePage({
  favourites,
  recents,
  onOpenTool,
}: {
  favourites: Tool[]
  recents: Tool[]
  onOpenTool: (id: Tool) => void
}) {
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState(getStoredTheme())
  const typed = useTypewriter(TAGLINES)

  useEffect(() => {
    const on = () => setTheme(getStoredTheme())
    window.addEventListener('devtools:themechange', on)
    return () => window.removeEventListener('devtools:themechange', on)
  }, [])

  const allTools = useMemo(() => GROUPS.flatMap((g) => g.tools).filter((t) => t.id !== 'home'), [])
  const toolDefs = useMemo(() => new Map(allTools.map((t) => [t.id, t])), [allTools])
  const newCount = allTools.filter((t) => t.isNew).length

  const favouriteDefs = favourites.map((id) => toolDefs.get(id)).filter((t): t is ToolDef => !!t)
  const recentDefs = recents
    .map((id) => toolDefs.get(id))
    .filter((t): t is ToolDef => !!t && !favourites.includes(t.id) && t.id !== 'home')
    .slice(0, 8)

  const q = query.trim().toLowerCase()
  const matches = (t: ToolDef) => !q || t.label.toLowerCase().includes(q) || t.hint.toLowerCase().includes(q)
  const filteredGroups = GROUPS.filter((g) => g.label !== 'Home')
    .map((g) => ({ ...g, tools: g.tools.filter(matches) }))
    .filter((g) => g.tools.length > 0)

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto overflow-x-hidden pb-8 pr-1 [&>*]:shrink-0">
      {/* ---------------- hero ---------------- */}
      <section className="relative pt-2">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} className="flex flex-wrap items-end gap-x-5 gap-y-1">
          <h1 className="font-display gradient-text m-0 text-[clamp(3.4rem,9vw,7.5rem)] leading-[0.85]">Dev Tools</h1>
          <span className="font-display stroke-text mb-1 text-[clamp(2.2rem,5.5vw,4.6rem)] leading-[0.85]">Suite</span>
        </motion.div>
        <div className="mt-3 flex min-h-[2.4rem] items-center gap-2 font-mono text-[clamp(1.05rem,2.2vw,1.6rem)] text-ink">
          <span className="text-cyan">❯</span>
          <span>{typed}</span>
          <span className="caret-blink inline-block h-[1.2em] w-[0.55em] bg-cyan" />
        </div>
        <p className="mt-2 max-w-3xl text-[1.0625rem] leading-relaxed text-ink-soft">
          {allTools.length} tools, one local Java process, zero telemetry. Press <kbd className="rounded-md bg-glass-strong px-1.5 py-0.5 font-mono text-[0.875rem]">Ctrl K</kbd> anywhere to jump, <kbd className="rounded-md bg-glass-strong px-1.5 py-0.5 font-mono text-[0.875rem]">Alt T</kbd> to hop worlds.
        </p>
        <div className="mt-5 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Tools', v: allTools.length, tone: 'text-cyan' },
            { label: 'New this release', v: newCount, tone: 'text-rose' },
            { label: 'Animated worlds', v: WORLD_THEMES.length, tone: 'text-violet' },
            { label: 'Bytes sent to cloud', v: 0, tone: 'text-emerald' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="rounded-2xl border border-rule-soft bg-glass px-4 py-3 backdrop-blur-sm">
              <div className={`font-display text-[2.4rem] leading-none ${s.tone}`}><CountUp to={s.v} /></div>
              <div className="mt-1 text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-ink-faint">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------- featured: release train ---------------- */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr]">
        <button onClick={() => onOpenTool('jenkins')} className="tile group overflow-hidden rounded-3xl border border-cyan/30 bg-[color-mix(in_srgb,var(--cyan)_7%,var(--surface))] p-5 text-left" onPointerMove={spot}>
          <div className="flex items-center gap-2 text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-cyan"><Rocket size={15} weight="fill" /> New · Jenkins Pipeline Studio</div>
          <div className="font-display mt-1 text-[clamp(1.9rem,3.4vw,2.8rem)] leading-none text-ink">CI → CD → Proceed → Helm tag</div>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">One button runs your whole release train: trigger CI, feed its version into CD, hit Proceed on the approval gate, and capture the Helm tag for rehydration. Live stages, live console.</p>
          <MiniTrain />
          <span className="mt-3 inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-cyan">Open Pipeline Studio <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-1" /></span>
        </button>
        <div className="flex flex-col gap-3">
          <button onClick={() => onOpenTool('rehydration')} className="tile group flex-1 rounded-3xl border border-violet/30 bg-[color-mix(in_srgb,var(--violet)_7%,var(--surface))] p-5 text-left" onPointerMove={spot}>
            <div className="flex items-center gap-2 text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-violet"><Tag size={15} weight="fill" /> Rehydration Board</div>
            <div className="mt-1 text-[1.0625rem] font-semibold text-ink">Every helm tag, per service and environment — with drift warnings, snapshots and one-click rehydrate.</div>
          </button>
          <div className="rounded-3xl border border-rule-soft bg-glass p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-ink-soft"><Sparkle size={14} weight="fill" className="text-rose" /> Pick a world</div>
            <div className="flex flex-wrap gap-1.5">
              {WORLD_THEMES.map((t) => (
                <motion.button
                  key={t.id}
                  whileHover={{ y: -3, scale: 1.04 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => applyTheme(t.id)}
                  title={t.tagline}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ring-1 transition-colors ${theme === t.id ? 'bg-glass-strong text-ink ring-cyan/60' : 'text-ink-soft ring-rule-soft hover:text-ink'}`}
                >
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: `conic-gradient(${t.swatch[0]} 0 40%, ${t.swatch[1]} 40% 70%, ${t.swatch[2]} 70%)` }} />
                  {t.name}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ---------------- marquee ---------------- */}
      <div data-layout-ok className="relative -mx-1 overflow-hidden py-1 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="marquee">
          {[...allTools, ...allTools].map((t, i) => (
            <button key={i} onClick={() => onOpenTool(t.id)} className="font-display shrink-0 whitespace-nowrap text-[1.6rem] text-ink-faint transition-colors hover:text-cyan">
              {t.label} <span className="text-rose">✦</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- search + grids ---------------- */}
      <div className="relative max-w-xl">
        <MagnifyingGlass size={18} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all tools…" className="devtools-input !rounded-2xl !py-3 pl-11 !text-[1.0625rem]" />
      </div>

      {!q && favouriteDefs.length > 0 && (
        <section>
          <SectionLabel><span className="inline-flex items-center gap-1.5 text-warm"><Star size={12} weight="fill" /> Favourites</span></SectionLabel>
          <ToolGrid tools={favouriteDefs} onOpenTool={onOpenTool} favourites={favourites} />
        </section>
      )}

      {!q && recentDefs.length > 0 && (
        <section>
          <SectionLabel>Recently used</SectionLabel>
          <ToolGrid tools={recentDefs} onOpenTool={onOpenTool} favourites={favourites} />
        </section>
      )}

      <section className="flex flex-col gap-5">
        {q && <SectionLabel>Search results</SectionLabel>}
        {q && filteredGroups.length === 0 && <div className="break-anywhere text-[0.9375rem] text-ink-faint">No tools match "{query.trim()}"</div>}
        {filteredGroups.map((group) => (
          <div key={group.label}>
            {!q && <SectionLabel>{group.label}</SectionLabel>}
            <ToolGrid tools={group.tools} onOpenTool={onOpenTool} favourites={favourites} />
          </div>
        ))}
      </section>
    </div>
  )
}

/** Pointer-follow spotlight + (crazy mode) 3D tilt on a tile. */
function spot(e: RPointerEvent<HTMLElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const x = e.clientX - r.left
  const y = e.clientY - r.top
  el.style.setProperty('--mx', `${x}px`)
  el.style.setProperty('--my', `${y}px`)
  if (getMotion() === 'crazy') {
    const rx = ((y / r.height) - 0.5) * -10
    const ry = ((x / r.width) - 0.5) * 12
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`
  }
}
function unspot(e: RPointerEvent<HTMLElement>) {
  e.currentTarget.style.transform = ''
}

function MiniTrain() {
  const steps = [
    { label: 'CI', icon: Rocket },
    { label: 'CD', icon: Rocket },
    { label: 'Proceed', icon: HandPalm },
    { label: 'Helm tag', icon: Tag },
    { label: 'Saved', icon: CheckCircle },
  ]
  const [at, setAt] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    if (getMotion() === 'off') {
      setAt(steps.length)
      return
    }
    const id = setInterval(() => {
      ref.current = (ref.current + 1) % (steps.length + 2)
      setAt(ref.current)
    }, 900)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="mt-4 flex items-center gap-0 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < at
        const active = i === at
        const Icon = s.icon
        return (
          <div key={s.label} className="flex shrink-0 items-center">
            <motion.div
              animate={done ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.875rem] font-semibold ring-1 transition-colors ${done ? 'bg-emerald/15 text-emerald ring-emerald/40' : active ? (s.label === 'Proceed' ? 'stage-waiting bg-warm/10 text-warm ring-warm/60' : 'stage-running text-cyan ring-cyan/60') : 'text-ink-faint ring-rule-soft'}`}
            >
              {done ? <CheckCircle size={15} weight="fill" /> : <Icon size={15} weight={active ? 'fill' : 'regular'} />} {s.label}
            </motion.div>
            {i < steps.length - 1 && <div className={`flow-connector mx-1 h-0.5 w-6 ${done ? 'active' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

function ToolGrid({ tools, onOpenTool, favourites }: { tools: ToolDef[]; onOpenTool: (id: Tool) => void; favourites: Tool[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {tools.map((t, i) => {
        const Icon = t.icon
        const isFav = favourites.includes(t.id)
        return (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: Math.min(i * 0.03, 0.3) }}
            onClick={() => onOpenTool(t.id)}
            onPointerMove={spot}
            onPointerLeave={unspot}
            className="tile group flex min-w-0 items-start gap-3 rounded-2xl border border-rule-soft bg-glass p-3.5 text-left hover:border-rule hover:bg-glass-strong"
          >
            <span className="tile-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--cyan)_12%,transparent)] text-cyan">
              <Icon size={21} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[0.9375rem] font-semibold text-ink">{t.label}</span>
                {isFav && <Star size={12} weight="fill" className="shrink-0 text-warm" />}
                {t.isNew && <span className="shrink-0 rounded-full bg-rose px-1.5 text-[0.6875rem] font-extrabold uppercase text-[var(--on-accent)]">new</span>}
              </div>
              <div className="line-clamp-2 text-[0.8125rem] leading-snug text-ink-faint">{t.hint}</div>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
