import { useMemo, useState } from 'react'
import { Table } from '@phosphor-icons/react'
import { diffRows, parseTable } from '../lib/rowDiff'
import { Panel, SectionLabel, ErrorBanner } from '../components/ui'

const SAMPLE_A = `id,name,status
1,Alice,active
2,Bob,active
3,Carol,active`

const SAMPLE_B = `id,name,status
1,Alice,active
2,Bob,inactive
4,Dave,active`

export function RowDiffPage() {
  const [a, setA] = useState(SAMPLE_A)
  const [b, setB] = useState(SAMPLE_B)
  const [keyColumn, setKeyColumn] = useState('id')
  const [error, setError] = useState<string | null>(null)

  const parsedA = useMemo(() => {
    try { setError(null); return parseTable(a) } catch (e) { setError(e instanceof Error ? e.message : 'Parse failed (A)'); return null }
  }, [a])
  const parsedB = useMemo(() => {
    try { return parseTable(b) } catch (e) { setError(e instanceof Error ? e.message : 'Parse failed (B)'); return null }
  }, [b])

  const result = useMemo(() => {
    if (!parsedA || !parsedB || !keyColumn.trim()) return null
    if (parsedA.rows.length === 0 && parsedB.rows.length === 0) return null
    return diffRows(parsedA, parsedB, keyColumn.trim())
  }, [parsedA, parsedB, keyColumn])

  const columns = useMemo(() => (parsedA && parsedB ? Array.from(new Set([...parsedA.columns, ...parsedB.columns])) : []), [parsedA, parsedB])

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel>
        <div className="flex items-center gap-2 p-3">
          <SectionLabel>Key column</SectionLabel>
          <select className="devtools-input w-auto text-xs" value={keyColumn} onChange={(e) => setKeyColumn(e.target.value)}>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="text-[10.5px] text-ink-faint">Rows are matched between A and B by this column. Paste CSV or a JSON array of objects.</div>
        </div>
      </Panel>

      <div className="grid shrink-0 grid-cols-2 gap-3" style={{ height: '30%' }}>
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-2 p-3">
            <SectionLabel>A</SectionLabel>
            <textarea value={a} onChange={(e) => setA(e.target.value)} spellCheck={false} className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3 font-mono text-[11.5px] text-ink outline-none focus:border-cyan/50" />
          </div>
        </Panel>
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-2 p-3">
            <SectionLabel>B</SectionLabel>
            <textarea value={b} onChange={(e) => setB(e.target.value)} spellCheck={false} className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3 font-mono text-[11.5px] text-ink outline-none focus:border-cyan/50" />
          </div>
        </Panel>
      </div>

      {error && <ErrorBanner message={error} />}

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {!result ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">
              <div className="flex flex-col items-center gap-2"><Table size={24} weight="light" />Row-level diff appears here.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-[11px] text-ink-faint">
                {result.unchangedCount} unchanged · {result.changed.length} changed · {result.onlyInA.length} only in A · {result.onlyInB.length} only in B
              </div>
              {result.changed.map((c) => (
                <div key={c.key} className="rounded-xl border border-rule-soft bg-glass px-3 py-2.5">
                  <div className="mb-1 font-mono text-[12px] text-ink">{keyColumn} = {c.key}</div>
                  {c.changedColumns.map((col) => (
                    <div key={col} className="flex items-center gap-2 text-[11.5px]">
                      <span className="w-24 shrink-0 truncate text-ink-faint">{col}</span>
                      <span className="rounded bg-rose/10 px-1.5 py-0.5 font-mono text-rose line-through">{c.a[col] || '∅'}</span>
                      <span className="text-ink-faint">→</span>
                      <span className="rounded bg-emerald/10 px-1.5 py-0.5 font-mono text-emerald">{c.b[col] || '∅'}</span>
                    </div>
                  ))}
                </div>
              ))}
              {result.onlyInA.map((r) => (
                <div key={`a-${r[keyColumn]}`} className="rounded-lg bg-rose/5 px-3 py-2 text-[12px] text-rose">− only in A: <span className="font-mono">{keyColumn}={r[keyColumn]}</span></div>
              ))}
              {result.onlyInB.map((r) => (
                <div key={`b-${r[keyColumn]}`} className="rounded-lg bg-emerald/5 px-3 py-2 text-[12px] text-emerald">+ only in B: <span className="font-mono">{keyColumn}={r[keyColumn]}</span></div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
