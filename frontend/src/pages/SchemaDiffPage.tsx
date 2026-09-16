import { useMemo, useState } from 'react'
import { Warning, GitDiff } from '@phosphor-icons/react'
import { diffSchemas, parseSchema } from '../lib/schemaDiff'
import { Panel, SectionLabel, ErrorBanner } from '../components/ui'

const SAMPLE_BEFORE = `CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  legacy_flag INT
);`

const SAMPLE_AFTER = `CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL
);`

export function SchemaDiffPage() {
  const [before, setBefore] = useState(SAMPLE_BEFORE)
  const [after, setAfter] = useState(SAMPLE_AFTER)
  const [error, setError] = useState<string | null>(null)

  const result = useMemo(() => {
    try {
      setError(null)
      const beforeTables = parseSchema(before)
      const afterTables = parseSchema(after)
      if (beforeTables.length === 0 && afterTables.length === 0) return null
      return diffSchemas(beforeTables, afterTables)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse failed')
      return null
    }
  }, [before, after])

  const riskyCount = result?.changes.filter((c) => c.risky).length ?? 0

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid shrink-0 grid-cols-2 gap-3" style={{ height: '38%' }}>
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-2 p-3">
            <SectionLabel>Before (old schema / migration)</SectionLabel>
            <textarea
              value={before}
              onChange={(e) => setBefore(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3 font-mono text-[11.5px] leading-relaxed text-ink outline-none focus:border-cyan/50"
            />
          </div>
        </Panel>
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-2 p-3">
            <SectionLabel>After (new schema / migration)</SectionLabel>
            <textarea
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3 font-mono text-[11.5px] leading-relaxed text-ink outline-none focus:border-cyan/50"
            />
          </div>
        </Panel>
      </div>

      {error && <ErrorBanner message={error} />}

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {!result ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">
              <div className="flex flex-col items-center gap-2">
                <GitDiff size={24} weight="light" />
                Paste CREATE TABLE statements on both sides to see what changed.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {riskyCount > 0 && (
                <div className="mb-1 flex items-center gap-2 rounded-xl border border-rose/40 bg-rose/5 px-3 py-2 text-[12px] text-rose">
                  <Warning size={14} weight="fill" /> {riskyCount} risky change{riskyCount > 1 ? 's' : ''} found
                </div>
              )}
              {result.addedTables.map((t) => (
                <div key={`add-${t}`} className="rounded-lg bg-glass px-3 py-2 text-[12px] text-emerald">+ new table <span className="font-mono">{t}</span></div>
              ))}
              {result.droppedTables.map((t) => (
                <div key={`drop-${t}`} className="rounded-lg bg-glass px-3 py-2 text-[12px] text-rose">− dropped table <span className="font-mono">{t}</span></div>
              ))}
              {result.changes.length === 0 && result.addedTables.length === 0 && result.droppedTables.length === 0 && (
                <div className="text-sm text-ink-faint">No differences found.</div>
              )}
              {result.changes.map((c, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] ${c.risky ? 'bg-rose/5' : 'bg-glass'}`}>
                  {c.risky && <Warning size={13} weight="fill" className="mt-0.5 shrink-0 text-rose" />}
                  <div>
                    <span className="font-mono text-ink">{c.table}</span>
                    {c.kind === 'added-column' && <span className="text-ink-soft"> + added column <span className="font-mono">{c.column.name} {c.column.type}{c.column.nullable ? '' : ' NOT NULL'}</span></span>}
                    {c.kind === 'dropped-column' && <span className="text-ink-soft"> − dropped column <span className="font-mono">{c.column.name}</span></span>}
                    {c.kind === 'changed-column' && (
                      <span className="text-ink-soft">
                        {' '}changed column <span className="font-mono">{c.before.name}</span>: <span className="font-mono">{c.before.type}{c.before.nullable ? '' : ' NOT NULL'}</span> → <span className="font-mono">{c.after.type}{c.after.nullable ? '' : ' NOT NULL'}</span>
                      </span>
                    )}
                    {c.reason && <div className="mt-0.5 text-[11px] text-rose">{c.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
