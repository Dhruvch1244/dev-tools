import { useState } from 'react'
import { FolderOpen, Stairs, Trash, Warning } from '@phosphor-icons/react'
import { scanMigrations, type MigrationEntry, type ScanResult } from '../lib/migrationsApi'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

const RECENTS_KEY = 'devtools.migrations-recent-paths'
const MAX_RECENTS = 8

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecents(list: string[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list))
}

const TOOL_COLOR: Record<string, string> = { FLYWAY: 'text-cyan', LIQUIBASE: 'text-violet' }

export function MigrationTimelinePage() {
  const [path, setPath] = useState('')
  const [recents, setRecents] = useState<string[]>(loadRecents)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  async function scan(targetPath: string) {
    if (!targetPath.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await scanMigrations(targetPath.trim())
      setResult(res)
      setExpanded(new Set())
      const next = [targetPath.trim(), ...recents.filter((p) => p !== targetPath.trim())].slice(0, MAX_RECENTS)
      setRecents(next)
      saveRecents(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  function removeRecent(p: string) {
    const next = recents.filter((r) => r !== p)
    setRecents(next)
    saveRecents(next)
  }

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="migration-timeline" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3 p-4">
            <SectionLabel>Migrations folder path</SectionLabel>
            <input
              className="devtools-input font-mono text-xs"
              placeholder="C:\code\my-service\src\main\resources\db\migration"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scan(path)}
            />
            <Button variant="primary" onClick={() => scan(path)} disabled={!path.trim() || loading}>
              <Stairs size={14} weight="light" /> {loading ? 'Scanning…' : 'Scan'}
            </Button>
            <div className="text-[11px] text-ink-faint">
              Recognizes Flyway files by filename (<code>V1__desc.sql</code>, <code>V1.1__desc.sql</code>,{' '}
              <code>R__desc.sql</code>) and Liquibase changeSets by content-sniffing a{' '}
              <code>&lt;databaseChangeLog&gt;</code> XML root. Heuristic, regex/tag-based — not a real
              migration engine, and doesn't follow Liquibase <code>&lt;include&gt;</code> chains or
              YAML/JSON changelogs. Everything runs locally by reading source files.
            </div>
          </div>
        </Panel>

        {recents.length > 0 && (
          <Panel className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col p-3">
              <SectionLabel>Recent folders</SectionLabel>
              <div className="flex-1 overflow-auto">
                {recents.map((p) => (
                  <div key={p} className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-soft hover:bg-glass">
                    <button onClick={() => { setPath(p); scan(p) }} className="flex flex-1 items-center gap-1.5 truncate text-left">
                      <FolderOpen size={12} weight="light" className="shrink-0 text-ink-faint" />
                      <span className="truncate font-mono">{p}</span>
                    </button>
                    <button onClick={() => removeRecent(p)} className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-rose group-hover:opacity-100">
                      <Trash size={11} weight="light" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        )}
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} />
          </div>
        )}

        {!result && !error && (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            <div className="flex flex-col items-center gap-2">
              <Stairs size={28} weight="light" />
              Point it at a migrations folder and hit Scan.
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-rule-soft px-4 py-3 text-[11px] text-ink-faint">
              <div>
                {result.filesScanned} file(s) scanned · {result.migrations.length} migration(s)
                {result.risks.length > 0 && <span className="text-rose"> · {result.risks.length} risk(s) flagged</span>}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {result.migrations.length === 0 ? (
                <div className="text-sm text-ink-faint">No Flyway/Liquibase migrations found.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {result.migrations.map((m: MigrationEntry, i: number) => (
                    <div key={i} className="rounded-xl border border-rule-soft bg-glass px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-16 shrink-0 text-[9.5px] font-semibold uppercase tracking-wide ${TOOL_COLOR[m.tool]}`}>{m.tool}</span>
                        <span className="w-16 shrink-0 font-mono text-[11.5px] font-semibold text-ink">{m.version}</span>
                        <span className="flex-1 truncate text-[12.5px] text-ink-soft">{m.description}</span>
                        {m.risks.length > 0 && (
                          <button
                            onClick={() => toggle(i)}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-rose/15 px-2 py-0.5 text-[10.5px] font-medium text-rose hover:bg-rose/25"
                          >
                            <Warning size={11} weight="bold" /> {m.risks.length}
                          </button>
                        )}
                        <span className="shrink-0 truncate font-mono text-[10px] text-ink-faint" style={{ maxWidth: '20%' }} title={m.filePath}>
                          {m.fileName}
                        </span>
                      </div>
                      {expanded.has(i) && m.risks.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1 border-t border-rule-soft pt-2">
                          {m.risks.map((r, ri) => (
                            <div key={ri} className="text-[11px] text-rose">
                              line {r.line} — {r.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
