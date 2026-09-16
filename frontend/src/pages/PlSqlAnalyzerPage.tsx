import { useMemo, useState } from 'react'
import { ArrowRight, CaretDown, Database, Download, FileCode, MagnifyingGlass, Package, Warning } from '@phosphor-icons/react'
import { scanPlSqlRepo, type Risk, type Routine, type ScanResult } from '../lib/plsqlApi'
import { Panel, SectionLabel, Button, ErrorBanner } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

type CallEdge = { from: string; to: string; toKnown: boolean }

function buildCallEdges(routines: Routine[]): CallEdge[] {
  const known = new Set(routines.map((r) => r.qualifiedName.toLowerCase()))
  const edges: CallEdge[] = []
  for (const r of routines) {
    for (const c of r.calls) {
      edges.push({ from: r.qualifiedName, to: c, toKnown: known.has(c.toLowerCase()) })
    }
  }
  return edges
}

function dotEscape(s: string): string {
  return s.replace(/"/g, '\\"')
}

function toDot(edges: CallEdge[]): string {
  const lines = ['digraph plsql_call_graph {', '  rankdir=LR;', '  node [shape=box, fontsize=10, fontname="monospace"];']
  for (const e of edges) {
    const style = e.toKnown ? '' : ' [style=dashed, color=gray]'
    lines.push(`  "${dotEscape(e.from)}" -> "${dotEscape(e.to)}"${style};`)
  }
  lines.push('}')
  return lines.join('\n')
}

function toCsv(edges: CallEdge[]): string {
  const rows = ['caller,callee,callee_resolved']
  for (const e of edges) rows.push(`"${e.from.replace(/"/g, '""')}","${e.to.replace(/"/g, '""')}",${e.toKnown}`)
  return rows.join('\n')
}

function mermaidId(s: string, ids: Map<string, string>): string {
  let id = ids.get(s)
  if (!id) {
    id = `n${ids.size}`
    ids.set(s, id)
  }
  return id
}

function toMermaid(edges: CallEdge[]): string {
  const ids = new Map<string, string>()
  const lines = ['graph LR']
  for (const e of edges) {
    const fromId = mermaidId(e.from, ids)
    const toId = mermaidId(e.to, ids)
    lines.push(`  ${fromId}["${e.from}"] ${e.toKnown ? '-->' : '-.->'} ${toId}["${e.to}"]`)
  }
  return lines.join('\n')
}

function download(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

type Tab = 'inventory' | 'graph' | 'tables' | 'risks'
const TABS: { id: Tab; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'graph', label: 'Call Graph' },
  { id: 'tables', label: 'Table Usage' },
  { id: 'risks', label: 'Risks' },
]

const KIND_COLOR: Record<string, string> = {
  PACKAGE: 'var(--violet)',
  PROCEDURE: 'var(--cyan)',
  FUNCTION: 'var(--emerald)',
  TRIGGER: 'var(--warm)',
  VIEW: 'var(--rose)',
}

export function PlSqlAnalyzerPage() {
  const [path, setPath] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('inventory')
  const [query, setQuery] = useState('')
  const [selectedRoutine, setSelectedRoutine] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  async function scan() {
    if (!path.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResult(await scanPlSqlRepo(path.trim()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  const routines = result?.routines ?? []
  const nonPackageRoutines = useMemo(() => routines.filter((r) => r.kind !== 'PACKAGE'), [routines])

  const filteredRoutines = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return routines
    return routines.filter((r) => r.qualifiedName.toLowerCase().includes(q) || r.filePath.toLowerCase().includes(q))
  }, [routines, query])

  const byQualifiedName = useMemo(() => new Map(nonPackageRoutines.map((r) => [r.qualifiedName.toLowerCase(), r])), [nonPackageRoutines])

  const tableMap = useMemo(() => {
    const map = new Map<string, { reads: Set<string>; writes: Set<string> }>()
    for (const r of nonPackageRoutines) {
      for (const t of r.tables) {
        const entry = map.get(t.table.toLowerCase()) ?? { reads: new Set<string>(), writes: new Set<string>() }
        if (t.access === 'READ') entry.reads.add(r.qualifiedName)
        else entry.writes.add(r.qualifiedName)
        map.set(t.table.toLowerCase(), entry)
      }
    }
    return Array.from(map.entries())
      .map(([table, v]) => ({ table, reads: Array.from(v.reads), writes: Array.from(v.writes) }))
      .sort((a, b) => b.reads.length + b.writes.length - (a.reads.length + a.writes.length))
  }, [nonPackageRoutines])

  const filteredTables = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? tableMap.filter((t) => t.table.toLowerCase().includes(q)) : tableMap
  }, [tableMap, query])

  const risksByKind = useMemo(() => {
    const groups = new Map<string, Risk[]>()
    for (const r of result?.risks ?? []) {
      const list = groups.get(r.kind) ?? []
      list.push(r)
      groups.set(r.kind, list)
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [result])

  const callEdges = useMemo(() => buildCallEdges(nonPackageRoutines), [nonPackageRoutines])

  function exportGraph(format: 'dot' | 'csv' | 'mermaid') {
    setExportOpen(false)
    if (format === 'dot') download(toDot(callEdges), 'plsql-call-graph.dot', 'text/vnd.graphviz')
    else if (format === 'csv') download(toCsv(callEdges), 'plsql-call-graph.csv', 'text/csv')
    else download(toMermaid(callEdges), 'plsql-call-graph.mmd', 'text/plain')
  }

  const selected = selectedRoutine ? byQualifiedName.get(selectedRoutine.toLowerCase()) ?? null : null
  const callers = useMemo(() => {
    if (!selected) return []
    return nonPackageRoutines.filter((r) => r.calls.some((c) => c.toLowerCase() === selected.qualifiedName.toLowerCase()))
  }, [selected, nonPackageRoutines])

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="plsql-analyzer" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-2 p-4">
            <SectionLabel>Repo folder to scan</SectionLabel>
            <input
              className="devtools-input font-mono text-xs"
              placeholder="C:\code\plsql-repo"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scan()}
            />
            <Button variant="primary" onClick={scan} disabled={!path.trim() || loading}>
              {loading ? 'Scanning…' : 'Scan'}
            </Button>
            <div className="text-[10.5px] text-ink-faint">
              Heuristic scan of .sql/.pks/.pkb/.prc/.fnc/.trg files — not a real PL/SQL parser, treat results as a strong
              starting point, not ground truth.
            </div>
            {result && (
              <div className="rounded-xl border border-rule-soft bg-glass p-2.5 text-[11px] text-ink-soft">
                {result.filesScanned} files · {routines.length} routines · {result.risks.length} risk flags
              </div>
            )}
          </div>
        </Panel>

        {result && (
          <Panel>
            <div className="flex flex-col gap-1 p-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-medium ${tab === t.id ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Panel>
        )}
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        {error && <div className="p-4"><ErrorBanner message={error} /></div>}
        {!error && !result && (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            <div className="flex flex-col items-center gap-2">
              <Package size={28} weight="light" />
              Point this at a folder of PL/SQL packages/procedures to build a searchable map.
            </div>
          </div>
        )}

        {!error && result && (
          <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
            {(tab === 'inventory' || tab === 'tables') && (
              <div className="flex items-center gap-2 rounded-xl border border-rule bg-panel px-3 py-2">
                <MagnifyingGlass size={14} weight="light" className="text-ink-faint" />
                <input
                  className="flex-1 bg-transparent text-xs text-ink outline-none"
                  placeholder={tab === 'inventory' ? 'Filter by name or file…' : 'Filter by table name…'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}

            {tab === 'inventory' && (
              <div className="flex flex-col gap-1">
                {filteredRoutines.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedRoutine(r.qualifiedName); setTab('graph') }}
                    className="flex items-center gap-2 rounded-lg bg-glass px-2.5 py-1.5 text-left text-xs hover:bg-glass-strong"
                  >
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-medium uppercase" style={{ color: KIND_COLOR[r.kind], background: 'var(--glass-strong)' }}>
                      {r.kind}
                    </span>
                    <span className="flex-1 truncate font-mono text-ink">{r.qualifiedName}</span>
                    <span className="shrink-0 text-[10.5px] text-ink-faint">{r.filePath}:{r.line}</span>
                  </button>
                ))}
                {filteredRoutines.length === 0 && <div className="text-xs text-ink-faint">No matches.</div>}
              </div>
            )}

            {tab === 'graph' && (
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex items-center gap-2">
                  <select
                    className="devtools-input flex-1 font-mono text-xs"
                    value={selectedRoutine ?? ''}
                    onChange={(e) => setSelectedRoutine(e.target.value || null)}
                  >
                    <option value="">Select a routine…</option>
                    {nonPackageRoutines.map((r, i) => (
                      <option key={i} value={r.qualifiedName}>{r.qualifiedName}</option>
                    ))}
                  </select>
                  <div className="relative shrink-0">
                    <Button variant="default" onClick={() => setExportOpen((o) => !o)} disabled={callEdges.length === 0} className="py-2 text-xs">
                      <Download size={13} weight="light" /> Export graph <CaretDown size={11} weight="bold" />
                    </Button>
                    {exportOpen && (
                      <div className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-rule bg-surface p-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
                        <button onClick={() => exportGraph('dot')} className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-ink-soft hover:bg-glass hover:text-ink">Graphviz (.dot)</button>
                        <button onClick={() => exportGraph('mermaid')} className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-ink-soft hover:bg-glass hover:text-ink">Mermaid (.mmd)</button>
                        <button onClick={() => exportGraph('csv')} className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-ink-soft hover:bg-glass hover:text-ink">CSV (.csv)</button>
                      </div>
                    )}
                  </div>
                </div>

                {!selected ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">Pick a routine to see its callers and callees.</div>
                ) : (
                  <div className="grid flex-1 grid-cols-3 gap-3 overflow-hidden">
                    <div className="flex flex-col gap-1 overflow-auto rounded-2xl border border-rule bg-panel p-3">
                      <SectionLabel>Callers ({callers.length})</SectionLabel>
                      {callers.length === 0 && <div className="text-xs text-ink-faint">Nothing calls this (that we found).</div>}
                      {callers.map((r, i) => (
                        <button key={i} onClick={() => setSelectedRoutine(r.qualifiedName)} className="truncate rounded-lg bg-glass px-2 py-1 text-left font-mono text-[11px] text-ink-soft hover:bg-glass-strong">
                          {r.qualifiedName}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-cyan/40 bg-glass p-3 text-center">
                      <FileCode size={20} weight="light" className="text-cyan" />
                      <div className="font-mono text-xs text-ink">{selected.qualifiedName}</div>
                      <div className="text-[10.5px] text-ink-faint">{selected.filePath}:{selected.line}</div>
                      {selected.tables.length > 0 && (
                        <div className="mt-1 flex flex-wrap justify-center gap-1">
                          {selected.tables.map((t, i) => (
                            <span key={i} className="rounded-full bg-glass-strong px-2 py-0.5 text-[10px]" style={{ color: t.access === 'WRITE' ? 'var(--rose)' : 'var(--emerald)' }}>
                              {t.access === 'WRITE' ? '✎' : '👁'} {t.table}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 overflow-auto rounded-2xl border border-rule bg-panel p-3">
                      <SectionLabel>Calls ({selected.calls.length})</SectionLabel>
                      {selected.calls.length === 0 && <div className="text-xs text-ink-faint">Doesn't call any known routine.</div>}
                      {selected.calls.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => byQualifiedName.has(c.toLowerCase()) && setSelectedRoutine(c)}
                          className="flex items-center gap-1.5 truncate rounded-lg bg-glass px-2 py-1 text-left font-mono text-[11px] text-ink-soft hover:bg-glass-strong"
                        >
                          <ArrowRight size={10} weight="bold" className="shrink-0 text-ink-faint" /> {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'tables' && (
              <div className="flex flex-col gap-2">
                {filteredTables.map((t, i) => (
                  <div key={i} className="flex flex-col gap-1.5 rounded-xl border border-rule-soft bg-glass px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Database size={13} weight="light" className="text-ink-faint" />
                      <span className="font-mono text-sm text-ink">{t.table}</span>
                      <span className="ml-auto text-[10.5px] text-ink-faint">{t.reads.length} read · {t.writes.length} write</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.reads.map((r, i2) => <span key={`r${i2}`} className="rounded-full bg-glass-strong px-2 py-0.5 text-[10px] text-emerald">👁 {r}</span>)}
                      {t.writes.map((r, i2) => <span key={`w${i2}`} className="rounded-full bg-glass-strong px-2 py-0.5 text-[10px] text-rose">✎ {r}</span>)}
                    </div>
                  </div>
                ))}
                {filteredTables.length === 0 && <div className="text-xs text-ink-faint">No table references found.</div>}
              </div>
            )}

            {tab === 'risks' && (
              <div className="flex flex-col gap-3">
                {risksByKind.length === 0 && <div className="text-xs text-ink-faint">No risk patterns flagged.</div>}
                {risksByKind.map(([kind, items]) => (
                  <div key={kind} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-warm">
                      <Warning size={13} weight="light" /> {kind} ({items.length})
                    </div>
                    {items.map((r, i) => (
                      <div key={i} className="rounded-lg bg-glass px-2.5 py-1.5 text-[11px]">
                        <span className="font-mono text-ink-faint">{r.filePath}:{r.line}</span>
                        <span className="ml-2 text-ink-soft">{r.message}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
