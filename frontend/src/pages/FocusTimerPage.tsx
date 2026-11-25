import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowCounterClockwise, Bell, Coffee, Flag, Pause, Play, Timer } from '@phosphor-icons/react'
import { Button, Field, Input, Panel, Segmented, SectionLabel, StatTile, Toggle } from '../components/ui'
import { celebrate } from '../components/CursorFx'

type Mode = 'pomodoro' | 'stopwatch' | 'countdown'
type Phase = 'focus' | 'short' | 'long'
const LS = 'devtools.focus.stats'

function beep() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.18, 0.36].forEach((t, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = [660, 880, 990][i]
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.17)
    })
  } catch {
    /* no audio */
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (ms: number, centis = false) => {
  const t = Math.max(0, ms)
  const h = Math.floor(t / 3600000)
  const m = Math.floor((t % 3600000) / 60000)
  const s = Math.floor((t % 60000) / 1000)
  return `${h ? h + ':' : ''}${pad(m)}:${pad(s)}${centis ? '.' + pad(Math.floor((t % 1000) / 10)) : ''}`
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}
function loadStats(): Record<string, { sessions: number; minutes: number }> {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? '{}')
  } catch {
    return {}
  }
}

export function FocusTimerPage() {
  const [mode, setMode] = useState<Mode>('pomodoro')
  const [lengths, setLengths] = useState({ focus: 25, short: 5, long: 15 })
  const [phase, setPhase] = useState<Phase>('focus')
  const [round, setRound] = useState(1)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [countdownMin, setCountdownMin] = useState(10)
  const [laps, setLaps] = useState<number[]>([])
  const [sound, setSound] = useState(true)
  const [notify, setNotify] = useState(false)
  const [stats, setStats] = useState(loadStats)
  const startRef = useRef(0)
  const baseRef = useRef(0)

  const total = mode === 'pomodoro' ? lengths[phase] * 60000 : mode === 'countdown' ? countdownMin * 60000 : 0
  const remaining = total - elapsed

  useEffect(() => {
    if (!running) return
    startRef.current = performance.now()
    baseRef.current = elapsed
    let raf = 0
    const tick = () => {
      setElapsed(baseRef.current + performance.now() - startRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  useEffect(() => {
    if (!running || mode === 'stopwatch' || remaining > 0) return
    setRunning(false)
    setElapsed(0)
    if (sound) beep()
    if (notify && 'Notification' in window && Notification.permission === 'granted') new Notification(mode === 'pomodoro' && phase === 'focus' ? 'Focus block done — take a break ☕' : 'Timer done ⏰')
    if (mode === 'pomodoro') {
      if (phase === 'focus') {
        celebrate()
        const k = todayKey()
        const next = { ...stats, [k]: { sessions: (stats[k]?.sessions ?? 0) + 1, minutes: (stats[k]?.minutes ?? 0) + lengths.focus } }
        setStats(next)
        try {
          localStorage.setItem(LS, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        setPhase(round % 4 === 0 ? 'long' : 'short')
      } else {
        setPhase('focus')
        setRound((r) => r + 1)
      }
    }
  }, [remaining, running, mode, phase, round, sound, notify, stats, lengths.focus])

  useEffect(() => {
    document.title = running && mode !== 'stopwatch' ? `${clock(remaining)} · ${mode === 'pomodoro' ? phase : 'timer'}` : 'Dev Tools'
    return () => {
      document.title = 'Dev Tools'
    }
  }, [running, remaining, mode, phase])

  function reset() {
    setRunning(false)
    setElapsed(0)
    setLaps([])
  }

  const progress = total ? Math.min(1, elapsed / total) : (elapsed % 60000) / 60000
  const R = 120
  const C = 2 * Math.PI * R
  const ringColor = mode === 'pomodoro' ? (phase === 'focus' ? 'var(--rose)' : 'var(--emerald)') : mode === 'countdown' ? 'var(--warm)' : 'var(--cyan)'
  const today = stats[todayKey()] ?? { sessions: 0, minutes: 0 }
  const week = Object.entries(stats).filter(([d]) => Date.now() - Date.parse(d) < 7 * 86400000).reduce((n, [, v]) => n + v.minutes, 0)

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <Segmented id="focus-mode" value={mode} onChange={(m) => { setMode(m); reset() }} options={[{ id: 'pomodoro', label: '🍅 Pomodoro' }, { id: 'stopwatch', label: '⏱ Stopwatch' }, { id: 'countdown', label: '⏳ Countdown' }]} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_24rem]">
        <Panel>
          <div className="flex flex-col items-center gap-5 p-8">
            {mode === 'pomodoro' && (
              <AnimatePresence mode="wait">
                <motion.div key={phase} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="flex items-center gap-2 text-[1rem] font-bold uppercase tracking-[0.2em]" style={{ color: ringColor }}>
                  {phase === 'focus' ? <Timer size={18} weight="fill" /> : <Coffee size={18} weight="fill" />} {phase === 'focus' ? `Focus · round ${round}` : phase === 'short' ? 'Short break' : 'Long break'}
                </motion.div>
              </AnimatePresence>
            )}
            <div className="relative">
              <svg width={300} height={300} viewBox="0 0 300 300" className="-rotate-90 max-w-full">
                <circle cx={150} cy={150} r={R} fill="none" stroke="var(--rule)" strokeWidth={14} />
                <circle cx={150} cy={150} r={R} fill="none" stroke={ringColor} strokeWidth={14} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ filter: `drop-shadow(0 0 14px ${ringColor})`, transition: running ? 'none' : 'stroke-dashoffset 0.4s' }} />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <motion.div animate={running ? { scale: [1, 1.03, 1] } : { scale: 1 }} transition={{ repeat: running ? Infinity : 0, duration: 2 }} className="font-display text-[4.4rem] leading-none text-ink">
                  {mode === 'stopwatch' ? clock(elapsed, true) : clock(remaining)}
                </motion.div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setRunning((r) => !r)} className="!px-8 !py-3 !text-[1.0625rem]">{running ? <><Pause size={18} weight="fill" /> Pause</> : <><Play size={18} weight="fill" /> {elapsed ? 'Resume' : 'Start'}</>}</Button>
              <Button onClick={reset}><ArrowCounterClockwise size={16} weight="bold" /> Reset</Button>
              {mode === 'stopwatch' && <Button onClick={() => setLaps((l) => [elapsed, ...l])} disabled={!running}><Flag size={16} weight="fill" /> Lap</Button>}
              {mode === 'pomodoro' && <Button variant="ghost" onClick={() => { reset(); setPhase(phase === 'focus' ? 'short' : 'focus') }}>Skip phase</Button>}
            </div>
            {laps.length > 0 && (
              <div className="w-full max-w-md">
                {laps.map((l, i) => <div key={i} className="flex justify-between border-t border-rule-soft py-1.5 font-mono text-[0.9375rem] text-ink-soft"><span>Lap {laps.length - i}</span><span>{clock(l - (laps[i + 1] ?? 0), true)}</span><span className="text-ink">{clock(l, true)}</span></div>)}
              </div>
            )}
          </div>
        </Panel>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Today" value={`${today.sessions}🍅`} tone="rose" hint={`${today.minutes} focused min`} />
            <StatTile label="Last 7 days" value={`${Math.round(week / 6) / 10}h`} tone="emerald" />
          </div>
          <Panel>
            <div className="flex flex-col gap-3 p-5">
              <SectionLabel>Settings</SectionLabel>
              {mode === 'pomodoro' && (
                <div className="grid grid-cols-3 gap-2">
                  {(['focus', 'short', 'long'] as const).map((k) => (
                    <Field key={k} label={`${k} min`}><Input type="number" min={1} max={180} value={lengths[k]} onChange={(e) => setLengths({ ...lengths, [k]: Math.max(1, Number(e.target.value) || 1) })} /></Field>
                  ))}
                </div>
              )}
              {mode === 'countdown' && (
                <>
                  <Field label="Minutes"><Input type="number" min={1} value={countdownMin} onChange={(e) => setCountdownMin(Math.max(1, Number(e.target.value) || 1))} /></Field>
                  <div className="flex flex-wrap gap-1.5">{[1, 3, 5, 10, 15, 30, 45, 60].map((m) => <button key={m} onClick={() => { reset(); setCountdownMin(m) }} className="rounded-full bg-glass px-3 py-1 text-[0.875rem] text-ink-soft ring-1 ring-rule-soft hover:text-ink">{m}m</button>)}</div>
                </>
              )}
              <Toggle checked={sound} onChange={setSound} label="Chime when done" />
              <Toggle checked={notify} onChange={async (v) => { if (v && 'Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission(); setNotify(v) }} label="Desktop notification" />
              <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-faint"><Bell size={14} /> The tab title shows the countdown while it runs.</div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
