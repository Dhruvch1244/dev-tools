import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DownloadSimple, Plus, TextAa, Trash, X } from '@phosphor-icons/react'
import { Button, CopyButton, Input, Panel, Toggle } from '../components/ui'

type Pad = { id: string; title: string; body: string; color: string; updated: number }
const LS = 'devtools.scratchpad'
const COLORS = ['cyan', 'violet', 'rose', 'warm', 'emerald']
const DOT: Record<string, string> = { cyan: 'bg-cyan', violet: 'bg-violet', rose: 'bg-rose', warm: 'bg-warm', emerald: 'bg-emerald' }
const uid = () => Math.random().toString(36).slice(2, 9)

function load(): { pads: Pad[]; active: string } {
  try {
    const raw = localStorage.getItem(LS)
    if (raw) {
      const p = JSON.parse(raw)
      if (Array.isArray(p.pads) && p.pads.length) return p
    }
  } catch {
    /* ignore */
  }
  const first = { id: uid(), title: 'Scratch', body: '', color: 'cyan', updated: Date.now() }
  return { pads: [first], active: first.id }
}

export function ScratchpadPage() {
  const initial = useMemo(load, [])
  const [pads, setPads] = useState<Pad[]>(initial.pads)
  const [active, setActive] = useState(initial.active)
  const [mono, setMono] = useState(true)
  const [saved, setSaved] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(LS, JSON.stringify({ pads, active }))
        setSaved(true)
      } catch {
        /* storage full */
      }
    }, 400)
    return () => clearTimeout(timer.current)
  }, [pads, active])

  const pad = pads.find((p) => p.id === active) ?? pads[0]
  const stats = useMemo(() => {
    const t = pad?.body ?? ''
    return { chars: t.length, words: (t.match(/\S+/g) ?? []).length, lines: t ? t.split('\n').length : 0 }
  }, [pad])

  function update(patch: Partial<Pad>) {
    setPads((ps) => ps.map((p) => (p.id === pad.id ? { ...p, ...patch, updated: Date.now() } : p)))
  }
  function add() {
    const p = { id: uid(), title: `Pad ${pads.length + 1}`, body: '', color: COLORS[pads.length % COLORS.length], updated: Date.now() }
    setPads([...pads, p])
    setActive(p.id)
  }
  function remove(id: string) {
    if (pads.length === 1) {
      update({ body: '' })
      return
    }
    const next = pads.filter((p) => p.id !== id)
    setPads(next)
    if (id === active) setActive(next[0].id)
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1">
        <AnimatePresence initial={false}>
          {pads.map((p) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className={`group flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 ring-1 transition-colors ${p.id === pad.id ? 'bg-glass-strong text-ink ring-rule' : 'text-ink-soft ring-transparent hover:bg-glass'}`}>
              <button onClick={() => setActive(p.id)} className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[p.color]}`} />{p.title || 'untitled'}
              </button>
              <button onClick={() => remove(p.id)} className="text-ink-faint opacity-0 transition-opacity hover:text-rose group-hover:opacity-100" aria-label={`Close ${p.title}`}><X size={12} weight="bold" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
        <button onClick={add} className="shrink-0 rounded-xl p-2 text-cyan hover:bg-glass" aria-label="New pad"><Plus size={17} weight="bold" /></button>
      </div>
      {pad && (
        <Panel className="min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={pad.title} onChange={(e) => update({ title: e.target.value })} className="!w-64 font-semibold" />
              <div className="flex gap-1">{COLORS.map((c) => <button key={c} onClick={() => update({ color: c })} className={`h-6 w-6 rounded-full ${DOT[c]} ${pad.color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]' : 'opacity-60'}`} aria-label={`Colour ${c}`} />)}</div>
              <Toggle checked={mono} onChange={setMono} label="Monospace" />
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[0.8125rem] text-ink-faint">{stats.words} words · {stats.chars} chars · {stats.lines} lines · {saved ? 'saved ✓' : 'saving…'}</span>
                <CopyButton text={pad.body} />
                <Button variant="ghost" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([pad.body], { type: 'text/plain' })); a.download = `${pad.title || 'scratch'}.txt`; a.click() }}><DownloadSimple size={15} /></Button>
                <Button variant="ghost" onClick={() => remove(pad.id)} className="!text-rose"><Trash size={15} /></Button>
              </div>
            </div>
            <textarea
              autoFocus
              spellCheck={!mono}
              value={pad.body}
              onChange={(e) => update({ body: e.target.value })}
              placeholder="Dump anything here — it autosaves in this browser. Ctrl/Cmd+K jumps to any tool."
              className={`min-h-0 w-full flex-1 resize-none rounded-2xl border border-rule bg-panel p-5 text-[1rem] leading-relaxed text-ink outline-none transition-shadow focus:border-cyan/50 focus:shadow-[var(--focus-ring)] ${mono ? 'font-mono' : 'font-sans'}`}
            />
            <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-faint"><TextAa size={14} /> Pads live in this browser's local storage only.</div>
          </div>
        </Panel>
      )}
    </div>
  )
}
