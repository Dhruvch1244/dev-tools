import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Trash } from '@phosphor-icons/react'
import { readLogTail } from '../lib/logToolsApi'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'

type Line = { text: string; id: number }

export function LogTailerPage() {
  const [path, setPath] = useState('')
  const [running, setRunning] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(-1)
  const idRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  async function poll() {
    try {
      const chunk = await readLogTail(path, offsetRef.current)
      offsetRef.current = chunk.offset
      if (chunk.lines.length > 0) {
        setLines((prev) => {
          const next = [...prev, ...chunk.lines.map((text) => ({ text, id: idRef.current++ }))]
          return next.length > 5000 ? next.slice(next.length - 5000) : next
        })
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        })
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read log')
      stop()
    }
  }

  function start() {
    if (!path.trim()) return
    setLines([])
    offsetRef.current = -1
    setRunning(true)
    poll()
    timerRef.current = window.setInterval(poll, 1500)
  }

  function stop() {
    setRunning(false)
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function clear() {
    setLines([])
  }

  const filterLower = filter.trim().toLowerCase()
  const visible = filterLower ? lines.filter((l) => l.text.toLowerCase().includes(filterLower)) : lines

  function levelColor(text: string): string {
    if (/\b(ERROR|SEVERE|FATAL)\b/i.test(text)) return 'text-rose'
    if (/\bWARN\b/i.test(text)) return 'text-warm'
    if (/\bDEBUG|TRACE\b/i.test(text)) return 'text-ink-faint'
    return 'text-ink-soft'
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel>
        <div className="flex flex-col gap-2 p-3">
          <SectionLabel>Log file to tail</SectionLabel>
          <div className="flex items-center gap-2">
            <input
              className="devtools-input flex-1 font-mono text-xs"
              placeholder="C:\logs\app.log"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              disabled={running}
              onKeyDown={(e) => e.key === 'Enter' && !running && start()}
            />
            {!running ? (
              <Button variant="primary" onClick={start} disabled={!path.trim()}>
                <Play size={13} weight="fill" /> Start
              </Button>
            ) : (
              <Button variant="default" onClick={stop}>
                <Pause size={13} weight="fill" /> Stop
              </Button>
            )}
            <Button variant="ghost" onClick={clear} disabled={lines.length === 0}>
              <Trash size={13} weight="light" /> Clear
            </Button>
          </div>
          <input
            className="devtools-input text-xs"
            placeholder="Filter (plain text, case-insensitive)…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </Panel>

      {error && <ErrorBanner message={error} />}

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-auto p-3 font-mono text-[11.5px] leading-relaxed">
          {visible.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">
              {running ? 'Waiting for new lines…' : 'Point this at a log file and hit Start. Polls every 1.5s for new lines.'}
            </div>
          ) : (
            visible.map((l) => (
              <div key={l.id} className={`whitespace-pre-wrap break-all ${levelColor(l.text)}`}>{l.text}</div>
            ))
          )}
        </div>
      </Panel>
    </div>
  )
}
