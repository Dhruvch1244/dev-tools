import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Desktop, Gear, Lightning, Shuffle, Sparkle, TextAa, TextT } from '@phosphor-icons/react'
import { SYSTEM_THEME_ID, THEMES, WORLD_THEMES, applyTheme, getStoredTheme, type Theme } from '../lib/themes'
import { FONTS, applyFont, getStoredFont } from '../lib/fonts'
import {
  MOTION_LEVELS,
  TEXT_SIZES,
  UI_FONTS,
  applyMotion,
  applyTextSize,
  applyUiFont,
  getMotion,
  getTextSize,
  getUiFont,
  type MotionLevel,
  type TextSize,
} from '../lib/appearance'
import { Segmented } from './ui'

export function SettingsPopover() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(getStoredTheme())
  const [font, setFont] = useState(getStoredFont())
  const [uiFont, setUiFont] = useState(getUiFont())
  const [textSize, setTextSize] = useState<TextSize>(getTextSize())
  const [motion_, setMotion] = useState<MotionLevel>(getMotion())
  const [pos, setPos] = useState({ left: 0, bottom: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    const onTheme = () => setTheme(getStoredTheme())
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('devtools:themechange', onTheme)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('devtools:themechange', onTheme)
    }
  }, [])

  function pick(id: string) {
    applyTheme(id)
    setTheme(id)
  }

  function surprise() {
    const pool = THEMES.filter((t) => t.id !== theme)
    pick(pool[Math.floor(Math.random() * pool.length)].id)
  }

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ left: Math.max(8, r.left), bottom: window.innerHeight - r.top + 8 })
    }
    setOpen((o) => !o)
  }

  const worldIds = new Set(WORLD_THEMES.map((t) => t.id))
  const classic = THEMES.filter((t) => !worldIds.has(t.id))

  return (
    <div ref={triggerRef} className="mt-auto">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-ink-soft transition-colors hover:bg-glass hover:text-ink"
      >
        <Gear size={18} weight="duotone" className="brand-mark" />
        <span className="flex-1 text-[0.9375rem] font-semibold">Appearance</span>
        <span className="rounded-full bg-glass px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-faint">Alt+T</span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: 12, scale: 0.95, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="panel-shell fixed z-[100]"
              style={{ left: pos.left, bottom: pos.bottom, width: 'min(27rem, calc(100vw - 16px))' }}
            >
              <div className="panel-core max-h-[82vh] overflow-y-auto p-4 shadow-[var(--shadow-pop)]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="font-display gradient-text text-[1.9rem]">Make it yours</div>
                  <button
                    onClick={surprise}
                    className="inline-flex items-center gap-1.5 rounded-full bg-glass px-3 py-1.5 text-[0.8125rem] font-semibold text-ink ring-1 ring-glass-strong transition-transform hover:scale-105 active:scale-95"
                  >
                    <Shuffle size={14} weight="bold" /> Surprise me
                  </button>
                </div>

                <Label icon={<TextT size={13} weight="bold" />}>Text size</Label>
                <div className="mb-4">
                  <Segmented
                    id="text-size"
                    value={textSize}
                    onChange={(v) => {
                      applyTextSize(v)
                      setTextSize(v)
                    }}
                    options={TEXT_SIZES.map((t) => ({ id: t.id, label: t.label }))}
                  />
                </div>

                <Label icon={<Lightning size={13} weight="bold" />}>Motion</Label>
                <div className="mb-1">
                  <Segmented
                    id="motion"
                    value={motion_}
                    onChange={(v) => {
                      applyMotion(v)
                      setMotion(v)
                    }}
                    options={MOTION_LEVELS.map((m) => ({ id: m.id, label: m.label }))}
                  />
                </div>
                <div className="mb-4 text-[0.8125rem] text-ink-faint">
                  {MOTION_LEVELS.find((m) => m.id === motion_)?.hint} · try ↑↑↓↓←→←→BA
                </div>

                <Label icon={<Sparkle size={13} weight="fill" />}>Animated worlds</Label>
                <div className="mb-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {WORLD_THEMES.map((t) => (
                    <ThemeButton key={t.id} theme={t} active={theme === t.id} onPick={pick} world />
                  ))}
                </div>

                <button
                  onClick={() => pick(SYSTEM_THEME_ID)}
                  className={`mb-3 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[0.875rem] transition-colors ${
                    theme === SYSTEM_THEME_ID ? 'border-cyan/50 bg-glass text-ink' : 'border-rule-soft text-ink-soft hover:border-rule hover:text-ink'
                  }`}
                >
                  <Desktop size={15} weight="light" className="shrink-0" />
                  <span className="flex-1">Match system</span>
                  <span className="text-[0.75rem] text-ink-faint">Paper / Constellation</span>
                  {theme === SYSTEM_THEME_ID && <Check size={13} weight="bold" className="text-cyan" />}
                </button>
                {(['dark', 'light'] as const).map((scheme) => (
                  <div key={scheme} className="mb-3">
                    <div className="mb-1.5 text-[0.75rem] font-semibold text-ink-faint">{scheme === 'light' ? 'Classic light' : 'Classic dark'}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {classic
                        .filter((t) => (t.scheme ?? 'dark') === scheme)
                        .map((t) => (
                          <ThemeButton key={t.id} theme={t} active={theme === t.id} onPick={pick} />
                        ))}
                    </div>
                  </div>
                ))}

                <Label icon={<TextAa size={13} weight="bold" />}>Interface font</Label>
                <div className="mb-4 grid grid-cols-2 gap-1.5">
                  {UI_FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        applyUiFont(f.id)
                        setUiFont(f.id)
                      }}
                      style={{ fontFamily: f.stack }}
                      className={`truncate rounded-xl border px-3 py-2 text-left text-[0.9375rem] transition-colors ${
                        uiFont === f.id ? 'border-cyan/50 bg-glass text-ink' : 'border-rule-soft text-ink-soft hover:border-rule'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>

                <Label icon={<TextAa size={13} weight="light" />}>Code font</Label>
                <div className="flex flex-col gap-1">
                  {FONTS.map((f) => {
                    const active = font === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          applyFont(f.id)
                          setFont(f.id)
                        }}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                          active ? 'border-cyan/50 bg-glass' : 'border-rule-soft hover:border-rule'
                        }`}
                      >
                        <span className="text-[0.875rem] text-ink-soft">{f.name}</span>
                        <span style={{ fontFamily: f.stack }} className="text-[0.9375rem] text-ink">
                          {f.sample}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

function Label({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-[0.16em] text-ink-soft">
      {icon}
      {children}
    </div>
  )
}

function ThemeButton({ theme, active, onPick, world }: { theme: Theme; active: boolean; onPick: (id: string) => void; world?: boolean }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onPick(theme.id)}
      title={theme.tagline}
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-[0.875rem] transition-colors ${
        active ? 'border-cyan/60 bg-glass-strong text-ink' : 'border-rule-soft text-ink-soft hover:border-rule hover:text-ink'
      }`}
    >
      <span
        className={`flex shrink-0 overflow-hidden rounded-full ring-1 ring-rule ${world ? 'h-7 w-7' : 'h-4 w-4'}`}
        style={world ? { background: `conic-gradient(${theme.swatch[0]} 0 40%, ${theme.swatch[1]} 40% 70%, ${theme.swatch[2]} 70%)` } : undefined}
      >
        {!world && (
          <>
            <span className="h-full w-1/3" style={{ background: theme.swatch[0] }} />
            <span className="h-full w-1/3" style={{ background: theme.swatch[1] }} />
            <span className="h-full w-1/3" style={{ background: theme.swatch[2] }} />
          </>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{theme.name}</span>
        {world && theme.tagline && <span className="block truncate text-[0.75rem] text-ink-faint">{theme.tagline}</span>}
      </span>
      {active && <Check size={13} weight="bold" className="shrink-0 text-cyan" />}
    </motion.button>
  )
}
