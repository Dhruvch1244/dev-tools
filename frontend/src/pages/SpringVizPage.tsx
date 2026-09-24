import { useEffect, useMemo, useState } from 'react'
import { Bug, Check, CloudArrowDown, Copy, Database, DownloadSimple, FolderOpen, GitBranch, Lightning, ShieldWarning, Stack, Trash, Warning } from '@phosphor-icons/react'
import { analyzeSpringRepo, type SpringVizEndpoint, type SpringVizEntity, type SpringVizEntryPoint, type SpringVizFinding, type SpringVizResponse } from '../lib/springVizApi'
import {
  createCollection as createApiCollection,
  listCollections as listApiCollections,
  listEnvironments as listApiEnvironments,
  saveEnvironment as saveApiEnvironment,
  saveRequest as saveApiRequest,
  updateEnvironment as updateApiEnvironment,
} from '../lib/apiClientApi'
import { buildPostmanCollection } from '../lib/postmanImport'
import { exportTextAsFile } from '../lib/export'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'
import { SpringVizGraph, GraphLegend } from '../components/SpringVizGraph'

function endpointKey(e: SpringVizEndpoint): string {
  return `${e.httpMethod} ${e.path} ${e.controllerClass}.${e.methodName}`
}

const RECENTS_KEY = 'devtools.springviz-recent-paths'
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

type Tab = 'graph' | 'endpoints' | 'findings' | 'entities' | 'entrypoints' | 'stats'

export function SpringVizPage() {
  const [path, setPath] = useState('')
  const [recents, setRecents] = useState<string[]>(loadRecents)
  const [result, setResult] = useState<SpringVizResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('graph')
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [copiedRowKey, setCopiedRowKey] = useState<string | null>(null)
  const [curlCopied, setCurlCopied] = useState(false)

  async function run(targetPath: string) {
    if (!targetPath.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await analyzeSpringRepo(targetPath.trim())
      setResult(res)
      setProjectFilter(null)
      const next = [targetPath.trim(), ...recents.filter((p) => p !== targetPath.trim())].slice(0, MAX_RECENTS)
      setRecents(next)
      saveRecents(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
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

  const baseUrl = result ? `http://localhost:${result.port ?? 8080}${result.contextPath ?? ''}` : ''

  function endpointUrl(e: SpringVizEndpoint): string {
    return (result?.workspace ? '' : baseUrl) + e.path
  }

  function curlFor(e: SpringVizEndpoint): string {
    return `curl -X ${e.httpMethod} '${endpointUrl(e)}'`
  }

  async function copyRowUrl(e: SpringVizEndpoint) {
    const key = endpointKey(e)
    await navigator.clipboard.writeText(endpointUrl(e))
    setCopiedRowKey(key)
    setTimeout(() => setCopiedRowKey((k) => (k === key ? null : k)), 1200)
  }

  async function copySelectedAsCurl() {
    const toCopy = filteredEndpoints.filter((e) => selectedEndpoints.has(endpointKey(e)))
    if (toCopy.length === 0) return
    await navigator.clipboard.writeText(toCopy.map(curlFor).join('\n'))
    setCurlCopied(true)
    setTimeout(() => setCurlCopied(false), 1200)
  }

  function exportSelectedAsJson() {
    if (!result) return
    const toExport = filteredEndpoints.filter((e) => selectedEndpoints.has(endpointKey(e)))
    const json = buildPostmanCollection(
      'Spring endpoints',
      toExport.map((e) => ({ name: `${e.controllerClass}.${e.methodName}`, method: e.httpMethod, url: endpointUrl(e) }))
    )
    exportTextAsFile('spring-endpoints.json', json, 'json')
  }

  const filteredNodes = useMemo(() => {
    if (!result || !projectFilter) return result?.nodes ?? []
    return result.nodes.filter((n) => n.project === projectFilter || n.kind === 'ExternalService')
  }, [result, projectFilter])
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes])
  const filteredEdges = useMemo(
    () => (result ? result.edges.filter((e) => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to)) : []),
    [result, filteredNodeIds]
  )
  const filteredEndpoints = useMemo(() => {
    if (!result || !projectFilter) return result?.endpoints ?? []
    return result.endpoints.filter((e) => e.project === projectFilter)
  }, [result, projectFilter])

  useEffect(() => { setSelectedEndpoints(new Set()); setImportMsg(null) }, [result, projectFilter])

  function toggleEndpoint(key: string) {
    setSelectedEndpoints((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAllEndpoints() {
    setSelectedEndpoints((prev) =>
      prev.size === filteredEndpoints.length ? new Set() : new Set(filteredEndpoints.map(endpointKey))
    )
  }

  async function importSelectedToApiClient() {
    if (selectedEndpoints.size === 0 || !result) return
    const collections = await listApiCollections()
    const existingNames = collections.map((c) => c.name).join(', ')
    const chosen = window.prompt(
      `Import ${selectedEndpoints.size} endpoint(s) into which API Client collection?` +
        (existingNames ? `\nExisting: ${existingNames}` : '') +
        `\nType an existing name to add to it, or a new name to create one:`,
      collections[0]?.name ?? 'Imported endpoints'
    )
    if (!chosen || !chosen.trim()) return
    const name = chosen.trim()
    setImporting(true)
    setError(null)
    setImportMsg(null)
    try {
      let coll = collections.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (!coll) coll = await createApiCollection(name)

      const envs = await listApiEnvironments(coll.id)
      const existingEnv = envs.find((e) => e.name === 'Imported')
      const vars = existingEnv ? JSON.parse(existingEnv.variablesJson) : {}
      vars.baseUrl = baseUrl
      if (existingEnv) await updateApiEnvironment(existingEnv.id, { collectionId: coll.id, name: 'Imported', variablesJson: JSON.stringify(vars) })
      else await saveApiEnvironment({ collectionId: coll.id, name: 'Imported', variablesJson: JSON.stringify(vars) })

      const toImport = filteredEndpoints.filter((e) => selectedEndpoints.has(endpointKey(e)))
      for (const e of toImport) {
        await saveApiRequest({
          collectionId: coll.id,
          name: `${e.controllerClass}.${e.methodName}`,
          method: e.httpMethod,
          url: '{{baseUrl}}' + e.path,
          headersJson: '[]',
          body: '',
        })
      }
      setImportMsg(`Imported ${toImport.length} endpoint(s) into "${coll.name}" (with a "${'Imported'}" environment for baseUrl).`)
      setSelectedEndpoints(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="springviz" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3 p-4">
            <SectionLabel>Spring Boot project path</SectionLabel>
            <input
              className="devtools-input font-mono text-xs"
              placeholder="C:\code\my-orders-service"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run(path)}
            />
            <Button variant="primary" onClick={() => run(path)} disabled={!path.trim() || loading}>
              <GitBranch size={14} weight="light" /> {loading ? 'Scanning…' : 'Analyze'}
            </Button>
            <div className="text-[11px] text-ink-faint">
              Point it at one project's root, a multi-module project's root, or a folder
              containing several independent services — it auto-detects a workspace (2+
              subfolders with their own pom.xml/build.gradle) and analyzes all of them,
              linking @FeignClient calls between them. Everything runs locally by reading
              source files — nothing is compiled or executed.
            </div>
          </div>
        </Panel>

        {recents.length > 0 && (
          <Panel className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col p-3">
              <SectionLabel>Recent projects</SectionLabel>
              <div className="flex-1 overflow-auto">
                {recents.map((p) => (
                  <div key={p} className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-soft hover:bg-glass">
                    <button onClick={() => { setPath(p); run(p) }} className="flex flex-1 items-center gap-1.5 truncate text-left">
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
              <GitBranch size={28} weight="light" />
              Point it at a Spring Boot project and hit Analyze.
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-rule-soft p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1 rounded-xl border border-rule bg-panel p-1">
                  {(['graph', 'endpoints', 'findings', 'entities', 'entrypoints', 'stats'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        tab === t ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'
                      }`}
                    >
                      {tabLabel(t)} {tabCount(t, result, filteredNodes.length, filteredEndpoints.length) !== null && `(${tabCount(t, result, filteredNodes.length, filteredEndpoints.length)})`}
                    </button>
                  ))}
                </div>
                {result.workspace && (
                  <select
                    className="devtools-input w-auto text-[11px]"
                    value={projectFilter ?? ''}
                    onChange={(e) => setProjectFilter(e.target.value || null)}
                  >
                    <option value="">All {result.projects.length} projects</option>
                    {result.projects.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-faint">
                <span>{result.javaFilesScanned} .java files scanned</span>
                {!result.workspace && <> · base URL <span className="font-mono text-ink-soft">{baseUrl}</span></>}
                {result.findings.some((f) => f.severity === 'high') && (
                  <button onClick={() => setTab('findings')} className="flex items-center gap-1 rounded-full bg-rose/12 px-2 py-0.5 text-rose">
                    <Bug size={11} weight="light" /> {result.findings.filter((f) => f.severity === 'high').length} high-severity
                  </button>
                )}
              </div>
            </div>

            {result.cycles.length > 0 && (
              <div className="flex shrink-0 items-start gap-2 border-b border-rule-soft bg-rose/[0.06] px-3.5 py-2.5 text-[11.5px] text-rose">
                <Warning size={14} weight="fill" className="mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">{result.cycles.length} circular dependenc{result.cycles.length === 1 ? 'y' : 'ies'} found:</span>{' '}
                  {result.cycles.map((c, i) => (
                    <span key={i} className="font-mono">
                      {c.path.join(' → ')}
                      {i < result.cycles.length - 1 ? '; ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {tab === 'graph' ? (
              <>
                <div className="shrink-0 border-b border-rule-soft px-3.5 py-2">
                  <GraphLegend />
                </div>
                <div className="flex-1 overflow-hidden">
                  <SpringVizGraph nodes={filteredNodes} edges={filteredEdges} cycles={result.cycles} />
                </div>
              </>
            ) : tab === 'endpoints' ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                {filteredEndpoints.length > 0 && (
                  <div className="flex shrink-0 items-center gap-2 border-b border-rule-soft px-4 py-2">
                    <Button
                      variant="primary"
                      onClick={importSelectedToApiClient}
                      disabled={selectedEndpoints.size === 0 || importing}
                      className="py-1.5 text-xs"
                    >
                      <CloudArrowDown size={13} weight="light" />
                      {importing ? 'Importing…' : `Import ${selectedEndpoints.size || ''} to API Client`}
                    </Button>
                    <Button
                      variant="default"
                      onClick={copySelectedAsCurl}
                      disabled={selectedEndpoints.size === 0}
                      className="py-1.5 text-xs"
                    >
                      {curlCopied ? <Check size={13} weight="bold" className="text-emerald" /> : <Copy size={13} weight="light" />}
                      {curlCopied ? 'Copied' : `Copy ${selectedEndpoints.size || ''} as cURL`}
                    </Button>
                    <Button
                      variant="default"
                      onClick={exportSelectedAsJson}
                      disabled={selectedEndpoints.size === 0}
                      className="py-1.5 text-xs"
                    >
                      <DownloadSimple size={13} weight="light" /> Export {selectedEndpoints.size || ''} as JSON
                    </Button>
                    {importMsg && <span className="text-[11.5px] text-emerald">{importMsg}</span>}
                  </div>
                )}
                <div className="flex-1 overflow-auto p-4 pt-2">
                  {filteredEndpoints.length === 0 ? (
                    <div className="text-sm text-ink-faint">No @RestController/@Controller endpoints found.</div>
                  ) : (
                    <table className="w-full text-left text-[12.5px]">
                      <thead className="sticky top-0 bg-panel">
                        <tr>
                          <th className="border-b border-rule px-3 py-2 font-medium text-ink-faint">
                            <input type="checkbox" checked={selectedEndpoints.size === filteredEndpoints.length} onChange={toggleAllEndpoints} />
                          </th>
                          <th className="border-b border-rule px-3 py-2 font-medium text-ink-faint">Method</th>
                          <th className="border-b border-rule px-3 py-2 font-medium text-ink-faint">Path</th>
                          <th className="border-b border-rule px-3 py-2 font-medium text-ink-faint">Controller</th>
                          {result.workspace && <th className="border-b border-rule px-3 py-2 font-medium text-ink-faint">Project</th>}
                          <th className="border-b border-rule px-3 py-2 font-medium text-ink-faint" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEndpoints.map((e, i) => {
                          const key = endpointKey(e)
                          return (
                            <tr key={i} className="group border-b border-rule-soft hover:bg-glass">
                              <td className="px-3 py-1.5">
                                <input type="checkbox" checked={selectedEndpoints.has(key)} onChange={() => toggleEndpoint(key)} />
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${methodColor(e.httpMethod)}`}>{e.httpMethod}</span>
                              </td>
                              <td className="px-3 py-1.5 font-mono text-ink">
                                {result.workspace ? '' : baseUrl}
                                {e.path}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-ink-faint">
                                {e.controllerClass}.{e.methodName}()
                              </td>
                              {result.workspace && <td className="px-3 py-1.5 text-ink-faint">{e.project}</td>}
                              <td className="px-3 py-1.5 text-right">
                                <button
                                  onClick={() => copyRowUrl(e)}
                                  title="Copy URL"
                                  className="text-ink-faint opacity-0 transition-opacity hover:text-cyan group-hover:opacity-100"
                                  style={{ opacity: copiedRowKey === key ? 1 : undefined }}
                                >
                                  {copiedRowKey === key ? <Check size={12} weight="bold" className="text-emerald" /> : <Copy size={12} weight="light" />}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : tab === 'findings' ? (
              <FindingsTab findings={result.findings} />
            ) : tab === 'entities' ? (
              <EntitiesTab entities={result.entities} />
            ) : tab === 'entrypoints' ? (
              <EntryPointsTab entryPoints={result.entryPoints} />
            ) : (
              <StatsTab result={result} />
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}

function tabLabel(t: Tab): string {
  switch (t) {
    case 'entrypoints': return 'Entry points'
    default: return t[0].toUpperCase() + t.slice(1)
  }
}

function tabCount(t: Tab, result: SpringVizResponse, nodeCount: number, endpointCount: number): number | null {
  switch (t) {
    case 'graph': return nodeCount
    case 'endpoints': return endpointCount
    case 'findings': return result.findings.length
    case 'entities': return result.entities.length
    case 'entrypoints': return result.entryPoints.length
    default: return null
  }
}

const SEVERITY_ORDER = ['high', 'medium', 'low', 'info'] as const
const SEVERITY_STYLE: Record<string, string> = {
  high: 'bg-rose/12 text-rose',
  medium: 'bg-warm/12 text-warm',
  low: 'bg-cyan/12 text-cyan',
  info: 'bg-glass text-ink-faint',
}

function FindingsTab({ findings }: { findings: SpringVizFinding[] }) {
  const [activeSeverities, setActiveSeverities] = useState<Set<string>>(new Set(SEVERITY_ORDER))
  const counts = useMemo(() => {
    const c: Record<string, number> = { high: 0, medium: 0, low: 0, info: 0 }
    for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1
    return c
  }, [findings])
  const visible = findings.filter((f) => activeSeverities.has(f.severity))

  function toggle(sev: string) {
    setActiveSeverities((prev) => {
      const next = new Set(prev)
      next.has(sev) ? next.delete(sev) : next.add(sev)
      return next
    })
  }

  if (findings.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-ink-faint">
        <ShieldWarning size={28} weight="light" />
        No findings — nothing suspicious turned up in this scan.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-1.5">
        {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((sev) => (
          <button
            key={sev}
            onClick={() => toggle(sev)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-opacity ${SEVERITY_STYLE[sev]} ${activeSeverities.has(sev) ? '' : 'opacity-35'}`}
          >
            {sev} · {counts[sev]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {visible.map((f, i) => (
          <div key={i} className="rounded-2xl border border-rule-soft bg-panel p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
              <span className="text-[10.5px] uppercase tracking-wide text-ink-faint">{f.category}</span>
              <span className="text-[13px] font-medium text-ink">{f.title}</span>
            </div>
            <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{f.detail}</div>
            {(f.className || f.file) && (
              <div className="mt-1.5 font-mono text-[11px] text-ink-faint">
                {f.className}{f.methodName ? `.${f.methodName}()` : ''}{f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ''}` : ''}
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && <div className="py-6 text-center text-xs text-ink-faint">No findings at the selected severities.</div>}
      </div>
    </div>
  )
}

function EntitiesTab({ entities }: { entities: SpringVizEntity[] }) {
  if (entities.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-ink-faint">
        <Database size={28} weight="light" />
        No @Entity/@Document classes found.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2.5 p-4">
      {entities.map((e) => (
        <div key={e.name} className="rounded-2xl border border-rule-soft bg-panel p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Database size={13} weight="light" className="text-emerald" />
            <span className="font-mono text-[13px] font-medium text-ink">{e.name}</span>
            {e.table && <span className="rounded-md bg-glass px-1.5 py-0.5 font-mono text-[10.5px] text-ink-faint">{e.table}</span>}
            <span className="text-[11px] text-ink-faint">{e.fieldCount} field{e.fieldCount === 1 ? '' : 's'}</span>
            {e.idType && <span className="text-[11px] text-ink-faint">· id: {e.idType}</span>}
          </div>
          {e.repositories.length > 0 && (
            <div className="mt-1.5 text-[11.5px] text-ink-soft">
              Repositories: <span className="font-mono text-ink-faint">{e.repositories.join(', ')}</span>
            </div>
          )}
          {e.relations.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              {e.relations.map((r, i) => (
                <div key={i} className="font-mono text-[11.5px] text-ink-faint">
                  <span className="text-ink-soft">{r.field}</span> — {r.kind}
                  {r.target ? ` → ${r.target}` : ''}
                  {r.eager && <span className="ml-1.5 rounded bg-warm/12 px-1 text-[9.5px] text-warm">EAGER</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const ENTRYPOINT_ICON: Record<string, React.ElementType> = {
  Scheduled: Lightning, Kafka: Stack, RabbitMQ: Stack, JMS: Stack, SQS: Stack, Stream: Stack,
  Event: Lightning, Async: Lightning, Startup: Lightning, Runner: Lightning,
}

function EntryPointsTab({ entryPoints }: { entryPoints: SpringVizEntryPoint[] }) {
  if (entryPoints.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-ink-faint">
        <Lightning size={28} weight="light" />
        No @Scheduled tasks, listeners, runners or @EventListener methods found.
      </div>
    )
  }
  const byKind = new Map<string, SpringVizEntryPoint[]>()
  for (const e of entryPoints) {
    if (!byKind.has(e.kind)) byKind.set(e.kind, [])
    byKind.get(e.kind)!.push(e)
  }
  return (
    <div className="flex flex-col gap-4 p-4">
      {[...byKind.entries()].map(([kind, items]) => {
        const Icon = ENTRYPOINT_ICON[kind] ?? Lightning
        return (
          <div key={kind}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <Icon size={12} weight="light" /> {kind} ({items.length})
            </div>
            <div className="flex flex-col gap-1">
              {items.map((e, i) => (
                <div key={i} className="rounded-xl border border-rule-soft bg-panel px-3 py-2 text-[12px]">
                  <span className="font-mono text-ink">{e.className}.{e.methodName}()</span>
                  {e.detail && <span className="ml-2 text-ink-faint">{e.detail}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatsTab({ result }: { result: SpringVizResponse }) {
  const s = result.stats
  const tiles: [string, number | string][] = [
    ['Java files', s.javaFiles],
    ['Test files', s.testFiles],
    ['Classes', s.classes],
    ['Interfaces', s.interfaces],
    ['Beans', s.beans],
    ['Endpoints', s.endpoints],
    ['Entities', s.entities],
    ['Lines of code', s.linesOfCode.toLocaleString()],
    ['Config files', s.configFiles],
  ]
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-rule-soft bg-panel p-3">
            <div className="text-lg font-semibold text-ink">{value}</div>
            <div className="text-[10.5px] uppercase tracking-wide text-ink-faint">{label}</div>
          </div>
        ))}
      </div>

      {result.profiles.length > 0 && (
        <div>
          <SectionLabel>Profiles found</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {result.profiles.map((p) => (
              <span key={p} className="rounded-full bg-glass px-2.5 py-1 text-[11px] font-mono text-ink-soft">{p}</span>
            ))}
          </div>
        </div>
      )}

      {result.configKeys.length > 0 && (
        <div>
          <SectionLabel>Referenced config keys ({result.configKeys.length})</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-rule-soft">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-panel text-[10.5px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">Default</th>
                  <th className="px-3 py-2 font-medium">Used in</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.configKeys.map((k) => (
                  <tr key={k.key} className="border-t border-rule-soft">
                    <td className="px-3 py-1.5 font-mono text-ink">{k.key}</td>
                    <td className="px-3 py-1.5 font-mono text-ink-faint">{k.defaultValue ?? '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-ink-faint">{k.usedIn.join(', ')}</td>
                    <td className="px-3 py-1.5">
                      {k.defined ? (
                        <span className="text-emerald">defined</span>
                      ) : (
                        <span className="text-rose">missing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {s.parseErrors.length > 0 && (
        <div>
          <SectionLabel>Files that failed to parse ({s.parseErrors.length})</SectionLabel>
          <div className="flex flex-col gap-1">
            {s.parseErrors.map((e, i) => (
              <div key={i} className="rounded-xl border border-rule-soft bg-panel px-3 py-2 text-[11.5px]">
                <span className="font-mono text-ink-soft">{e.file}</span>
                <div className="mt-0.5 text-ink-faint">{e.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET': return 'bg-cyan/15 text-cyan'
    case 'POST': return 'bg-emerald/15 text-emerald'
    case 'PUT': return 'bg-warm/15 text-warm'
    case 'PATCH': return 'bg-violet/15 text-violet'
    case 'DELETE': return 'bg-rose/15 text-rose'
    default: return 'bg-glass text-ink-soft'
  }
}
