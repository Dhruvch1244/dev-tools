import { useMemo, useState } from 'react'
import { Warning, Stack } from '@phosphor-icons/react'
import { parseThreadDump, type ThreadState } from '../lib/threadDump'
import { Panel, SectionLabel, Button } from '../components/ui'

const STATE_COLOR: Record<ThreadState, string> = {
  RUNNABLE: 'var(--emerald)',
  BLOCKED: 'var(--rose)',
  WAITING: 'var(--warm)',
  TIMED_WAITING: 'var(--cyan)',
  NEW: 'var(--ink-faint)',
  TERMINATED: 'var(--ink-faint)',
  UNKNOWN: 'var(--ink-faint)',
}

export function ThreadDumpAnalyzerPage() {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState<ThreadState | null>(null)

  const result = useMemo(() => (text.trim() ? parseThreadDump(text) : null), [text])

  const byState = useMemo(() => {
    const map = new Map<ThreadState, number>()
    for (const t of result?.threads ?? []) map.set(t.state, (map.get(t.state) ?? 0) + 1)
    return map
  }, [result])

  const visibleThreads = useMemo(() => {
    if (!result) return []
    return stateFilter ? result.threads.filter((t) => t.state === stateFilter) : result.threads
  }, [result, stateFilter])

  const selectedThread = result?.threads.find((t) => t.name === selected) ?? null

  return (
    <div className="flex h-full gap-4">
      <Panel className="flex w-[26rem] shrink-0 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-2 p-4">
          <SectionLabel>Thread dump</SectionLabel>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder='Paste the output of "jstack &lt;pid&gt;" or a "kill -3" dump here…'
            className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3 font-mono text-[11px] leading-relaxed text-ink outline-none focus:border-cyan/50"
          />
          {text && <Button variant="ghost" onClick={() => setText('')}>Clear</Button>}
        </div>
      </Panel>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden">
        {!result ? (
          <Panel className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-sm text-ink-faint">
              <Stack size={28} weight="light" />
              Paste a thread dump to see thread states and deadlock detection.
            </div>
          </Panel>
        ) : (
          <>
            {result.deadlockCycles.length > 0 && (
              <Panel>
                <div className="flex flex-col gap-2 border border-rose/40 bg-rose/5 p-3.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-rose">
                    <Warning size={16} weight="fill" /> {result.deadlockCycles.length} deadlock cycle{result.deadlockCycles.length > 1 ? 's' : ''} detected
                  </div>
                  {result.deadlockCycles.map((cycle, i) => (
                    <div key={i} className="font-mono text-[11.5px] text-ink-soft">
                      {cycle.map((name, j) => (
                        <span key={j}>
                          <button onClick={() => setSelected(name)} className="text-cyan hover:underline">{name}</button>
                          {j < cycle.length - 1 ? ' → waits on → ' : ` → waits on → ${cycle[0]}`}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel>
              <div className="flex flex-wrap items-center gap-1.5 p-3">
                <button
                  onClick={() => setStateFilter(null)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${stateFilter === null ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
                >
                  All ({result.threads.length})
                </button>
                {Array.from(byState.entries()).map(([state, count]) => (
                  <button
                    key={state}
                    onClick={() => setStateFilter(state)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${stateFilter === state ? 'bg-glass-strong' : 'hover:bg-glass'}`}
                    style={{ color: STATE_COLOR[state] }}
                  >
                    {state} ({count})
                  </button>
                ))}
              </div>
            </Panel>

            <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden">
              <Panel className="flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-2">
                  {visibleThreads.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelected(t.name)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        selected === t.name ? 'bg-glass-strong text-ink' : 'text-ink-soft hover:bg-glass'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATE_COLOR[t.state] }} />
                      <span className="flex-1 truncate font-mono">{t.name}</span>
                      {t.waitingToLock && <Warning size={11} weight="fill" className="shrink-0 text-rose" />}
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel className="flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-3">
                  {!selectedThread ? (
                    <div className="flex h-full items-center justify-center text-sm text-ink-faint">Select a thread to see its stack.</div>
                  ) : (
                    <>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-mono text-sm text-ink">{selectedThread.name}</span>
                        <span className="rounded-full bg-glass-strong px-2 py-0.5 text-[10px] font-medium" style={{ color: STATE_COLOR[selectedThread.state] }}>
                          {selectedThread.state}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-ink-soft">
                        {selectedThread.stack.join('\n') || '(no stack frames captured)'}
                      </pre>
                    </>
                  )}
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
