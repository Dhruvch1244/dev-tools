import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  ArrowsClockwise,
  Broom,
  Copy as CopyIcon,
  DownloadSimple,
  PaperPlaneRight,
  Plus,
  QrCode,
  Trash,
  UploadSimple,
  WifiHigh,
} from '@phosphor-icons/react'
import {
  clearMockLog,
  createMockRoute,
  deleteMockRoute,
  getMockLog,
  getMockNetwork,
  importMockRoutes,
  listMockRoutes,
  toSave,
  updateMockRoute,
  type MockLogEntry,
  type MockNetworkInfo,
  type MockRoute,
  type MockRouteSave,
} from '../lib/mockServerApi'
import { exportTextAsFile } from '../lib/export'
import { Button, Panel, SectionLabel, ErrorBanner, Toggle, CopyButton } from '../components/ui'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ANY']
const STATUS_PRESETS = [200, 201, 204, 400, 401, 403, 404, 409, 422, 500, 503]
const CONTENT_TYPES = ['application/json', 'text/plain', 'text/html', 'application/xml', 'text/csv']

const EMPTY: MockRouteSave = {
  method: 'GET',
  path: '/users/{id}',
  status: 200,
  responseBody: '{\n  "id": "{{path.id}}",\n  "name": "Ada Lovelace",\n  "requestId": "{{uuid}}",\n  "at": "{{now}}"\n}',
  contentType: 'application/json',
  delayMs: 0,
  enabled: true,
  headersJson: '',
  templated: true,
}

const TEMPLATE_HELP: [string, string][] = [
  ['{{path.id}}', 'a {id} segment of the route'],
  ['{{query.page}}', 'a ?page= query parameter'],
  ['{{header.Authorization}}', 'a request header'],
  ['{{body}} · {{body.user.name}}', 'raw body, or a field of a JSON body'],
  ['{{uuid}} · {{now}} · {{epoch}}', 'fresh id / ISO time / unix seconds'],
  ['{{randomInt 1 100}}', 'random integer in a range'],
]

type Tab = 'editor' | 'log'

export function MockServerPage() {
  const [routes, setRoutes] = useState<MockRoute[]>([])
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<MockRouteSave>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<Tab>('editor')
  const [network, setNetwork] = useState<MockNetworkInfo | null>(null)
  const [baseUrl, setBaseUrl] = useState<string>('')
  const [showQr, setShowQr] = useState(false)
  const [log, setLog] = useState<MockLogEntry[]>([])
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [testPath, setTestPath] = useState('')
  const [testResult, setTestResult] = useState<{ status: number; ms: number; body: string; headers: [string, string][] } | null>(null)
  const [testing, setTesting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const lastSeq = useRef(0)

  const localBase = `${window.location.origin}/mock`

  const refresh = () => listMockRoutes().then(setRoutes).catch((e) => setError(e.message))
  const loadNetwork = () =>
    getMockNetwork()
      .then((n) => {
        setNetwork(n)
        setBaseUrl((cur) => cur || n.addresses[0]?.baseUrl || localBase)
      })
      .catch(() => setBaseUrl((cur) => cur || localBase))

  useEffect(() => {
    refresh()
    loadNetwork()
  }, [])

  // Poll the request log; cheap because the server only returns entries newer than the last one seen.
  useEffect(() => {
    let alive = true
    const tick = () =>
      getMockLog(lastSeq.current)
        .then((fresh) => {
          if (!alive || fresh.length === 0) return
          lastSeq.current = fresh[0].seq
          setLog((prev) => [...fresh, ...prev].slice(0, 200))
        })
        .catch(() => {})
    tick()
    const id = setInterval(tick, 1500)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const filteredRoutes = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? routes.filter((r) => `${r.method} ${r.path} ${r.status}`.toLowerCase().includes(q)) : routes
  }, [routes, filter])

  const bodyJsonError = useMemo(() => {
    if (!form.contentType.includes('json') || !form.responseBody.trim()) return null
    // Templates inside strings are fine; a bare {{randomInt}} used as a number isn't valid JSON until rendered.
    const probe = form.templated ? form.responseBody.replace(/\{\{[^}]+}}/g, '0') : form.responseBody
    try {
      JSON.parse(probe)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON'
    }
  }, [form.responseBody, form.contentType, form.templated])

  const headersError = useMemo(() => {
    if (!form.headersJson.trim()) return null
    try {
      const parsed = JSON.parse(form.headersJson)
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) return 'Must be a JSON object'
      return Object.values(parsed).every((v) => typeof v === 'string') ? null : 'Header values must be strings'
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON'
    }
  }, [form.headersJson])

  function samplePath(p: string) {
    return p.replace(/\{[^}]+}/g, '1').replace(/\/\*\*$/, '/any/thing').replace(/\/\*(?=\/|$)/g, '/x')
  }

  function startNew() {
    setForm(EMPTY)
    setEditingId('new')
    setTab('editor')
    setTestResult(null)
    setTestPath(samplePath(EMPTY.path))
  }

  function startEdit(r: MockRoute) {
    setForm(toSave(r))
    setEditingId(r.id)
    setTab('editor')
    setTestResult(null)
    setTestPath(samplePath(r.path))
  }

  async function save() {
    if (!form.path.trim() || headersError) return
    setError(null)
    try {
      if (editingId === 'new') {
        const created = await createMockRoute(form)
        setEditingId(created.id)
      } else if (typeof editingId === 'number') {
        await updateMockRoute(editingId, form)
      }
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function duplicate() {
    setError(null)
    try {
      const created = await createMockRoute({ ...form, path: form.path.replace(/\/?$/, '-copy') })
      await refresh()
      startEdit(created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate failed')
    }
  }

  async function toggleEnabled(r: MockRoute) {
    try {
      await updateMockRoute(r.id, { ...toSave(r), enabled: !r.enabled })
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this mock route?')) return
    await deleteMockRoute(id)
    if (editingId === id) setEditingId(null)
    refresh()
  }

  function exportAll() {
    exportTextAsFile('mock-routes.json', JSON.stringify({ version: 1, routes: routes.map(toSave) }, null, 2), 'json')
  }

  async function importFile(file: File) {
    setError(null)
    try {
      const parsed = JSON.parse(await file.text())
      const list: MockRouteSave[] = Array.isArray(parsed) ? parsed : parsed.routes
      if (!Array.isArray(list)) throw new Error('Expected a mock-routes.json export (an object with a "routes" array).')
      const replace = routes.length > 0 && window.confirm(`Replace all ${routes.length} existing route(s)?\nOK = replace, Cancel = add alongside.`)
      const res = await importMockRoutes(list, replace)
      await refresh()
      setError(null)
      window.alert(`Imported ${res.imported} route(s).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    }
  }

  async function sendTest() {
    setTesting(true)
    const started = performance.now()
    try {
      const method = form.method === 'ANY' ? 'GET' : form.method
      const res = await fetch(`/mock${testPath.startsWith('/') ? testPath : `/${testPath}`}`, {
        method,
        headers: ['POST', 'PUT', 'PATCH'].includes(method) ? { 'Content-Type': 'application/json' } : undefined,
        body: ['POST', 'PUT', 'PATCH'].includes(method) ? '{"sample":true}' : undefined,
      })
      const text = method === 'HEAD' ? '' : await res.text()
      let pretty = text
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        /* not JSON — show as-is */
      }
      setTestResult({ status: res.status, ms: Math.round(performance.now() - started), body: pretty, headers: [...res.headers.entries()] })
    } catch (e) {
      setTestResult({ status: 0, ms: Math.round(performance.now() - started), body: e instanceof Error ? e.message : 'Request failed', headers: [] })
    } finally {
      setTesting(false)
    }
  }

  function formatBody() {
    try {
      setForm({ ...form, responseBody: JSON.stringify(JSON.parse(form.responseBody), null, 2) })
    } catch {
      /* leave as-is; the inline error explains why */
    }
  }

  const shareUrl = baseUrl || localBase
  const unmatchedCount = log.filter((l) => l.routeId === null).length

  return (
    <div className="flex h-full gap-4">
      <Panel className="flex w-80 shrink-0 flex-col overflow-hidden xl:w-96">
        <div className="flex shrink-0 flex-col gap-2 border-b border-rule-soft p-3">
          <div className="flex items-center justify-between px-1">
            <SectionLabel>Mock routes · {routes.length}</SectionLabel>
            <div className="-mt-2 flex items-center gap-0.5">
              <IconBtn label="Import routes from JSON" onClick={() => fileInput.current?.click()}><UploadSimple size={14} weight="light" /></IconBtn>
              <IconBtn label="Export all routes as JSON" onClick={exportAll} disabled={routes.length === 0}><DownloadSimple size={14} weight="light" /></IconBtn>
              <IconBtn label="New route" onClick={startNew}><Plus size={14} weight="bold" /></IconBtn>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importFile(f)
                e.target.value = ''
              }}
            />
          </div>
          {routes.length > 4 && (
            <input className="devtools-input py-1.5 text-xs" placeholder="Filter routes…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5 overflow-auto p-2">
          {filteredRoutes.map((r) => (
            <div
              key={r.id}
              className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs transition-colors ${
                editingId === r.id ? 'bg-glass-strong' : 'hover:bg-glass'
              }`}
            >
              <MethodBadge method={r.method} />
              <button onClick={() => startEdit(r)} className="flex min-w-0 flex-1 flex-col text-left">
                <span className={`truncate font-mono ${r.enabled ? 'text-ink' : 'text-ink-faint line-through'}`}>{r.path}</span>
                <span className="text-[10.5px] text-ink-faint">
                  <StatusText status={r.status} />
                  {r.delayMs > 0 && ` · ${r.delayMs}ms`}
                  {r.headersJson && ' · headers'}
                </span>
              </button>
              <Toggle checked={r.enabled} onChange={() => toggleEnabled(r)} label="" />
              <button
                aria-label={`Delete ${r.method} ${r.path}`}
                onClick={() => remove(r.id)}
                className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-rose focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash size={12} weight="light" />
              </button>
            </div>
          ))}
          {routes.length === 0 && (
            <div className="flex flex-col items-start gap-2 px-2 py-3 text-xs text-ink-faint">
              No mock routes yet.
              <Button variant="default" className="py-1.5 text-xs" onClick={startNew}>
                <Plus size={12} weight="bold" /> Create your first route
              </Button>
            </div>
          )}
        </div>
      </Panel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        {/* Network share strip: the URL other devices should use, not "localhost". */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule-soft px-4 py-3">
          <WifiHigh size={16} weight="light" className="text-cyan" />
          <span className="text-xs text-ink-soft">Reachable at</span>
          <select className="devtools-input w-auto max-w-full py-1.5 font-mono text-xs" value={shareUrl} onChange={(e) => setBaseUrl(e.target.value)}>
            {network?.addresses.map((a) => (
              <option key={a.baseUrl} value={a.baseUrl}>
                {a.baseUrl} — {a.displayName || a.interfaceName}
              </option>
            ))}
            <option value={localBase}>{localBase} — this machine only</option>
          </select>
          <CopyButton text={shareUrl} label="" />
          <IconBtn label={showQr ? 'Hide QR code' : 'Show QR code for phones'} onClick={() => setShowQr((v) => !v)} active={showQr}>
            <QrCode size={15} weight="light" />
          </IconBtn>
          <IconBtn label="Re-detect network addresses" onClick={loadNetwork}><ArrowsClockwise size={14} weight="light" /></IconBtn>
          <div className="ml-auto flex gap-1 rounded-xl border border-rule bg-panel p-1">
            {(['editor', 'log'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${tab === t ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
              >
                {t === 'editor' ? 'Route' : `Request log${log.length ? ` · ${log.length}` : ''}`}
              </button>
            ))}
          </div>
        </div>

        {showQr && <QrStrip url={shareUrl + (editingId !== null && testPath ? testPath : '')} />}

        <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
          {error && <ErrorBanner message={error} />}

          {tab === 'log' ? (
            <RequestLog
              log={log}
              routes={routes}
              expanded={expandedLog}
              onExpand={setExpandedLog}
              unmatchedCount={unmatchedCount}
              onClear={async () => {
                await clearMockLog()
                setLog([])
              }}
            />
          ) : editingId === null ? (
            <EmptyState shareUrl={shareUrl} onNew={startNew} lanAvailable={(network?.addresses.length ?? 0) > 0} />
          ) : (
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="HTTP method"
                    className="devtools-input w-auto font-mono text-xs"
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <div className="flex min-w-[14rem] flex-1 items-center rounded-xl border border-rule bg-panel pl-3 focus-within:border-cyan/50 focus-within:shadow-[var(--focus-ring)]">
                    <span className="font-mono text-xs text-ink-faint">/mock</span>
                    <input
                      aria-label="Route path"
                      className="w-full bg-transparent px-1 py-2.5 font-mono text-xs text-ink outline-none"
                      placeholder="/users/{id}"
                      value={form.path}
                      onChange={(e) => setForm({ ...form, path: e.target.value })}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-ink-faint">
                  <span className="font-mono">{'{name}'}</span> captures a segment, <span className="font-mono">*</span> matches any one segment,
                  a trailing <span className="font-mono">/**</span> matches the rest. The most specific route wins.
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Status">
                    <input
                      type="number"
                      list="mock-status-presets"
                      className="devtools-input w-24 font-mono"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}
                    />
                    <datalist id="mock-status-presets">
                      {STATUS_PRESETS.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </Field>
                  <Field label="Content-Type">
                    <input
                      list="mock-content-types"
                      className="devtools-input w-52 font-mono"
                      value={form.contentType}
                      onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                    />
                    <datalist id="mock-content-types">
                      {CONTENT_TYPES.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </Field>
                  <Field label="Delay (ms)">
                    <input
                      type="number"
                      min={0}
                      max={60000}
                      step={100}
                      className="devtools-input w-24 font-mono"
                      value={form.delayMs}
                      onChange={(e) => setForm({ ...form, delayMs: Number(e.target.value) })}
                    />
                  </Field>
                  <div className="flex flex-col gap-2 pb-2">
                    <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Enabled" />
                    <Toggle checked={form.templated} onChange={(v) => setForm({ ...form, templated: v })} label="Expand {{templates}}" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <SectionLabel>Response body</SectionLabel>
                  {form.contentType.includes('json') && (
                    <button onClick={formatBody} className="-mt-2 text-[11px] text-ink-faint hover:text-cyan">Format JSON</button>
                  )}
                </div>
                <textarea
                  value={form.responseBody}
                  onChange={(e) => setForm({ ...form, responseBody: e.target.value })}
                  spellCheck={false}
                  rows={12}
                  className="resize-y rounded-2xl border border-rule bg-panel p-3 font-mono text-[12px] leading-relaxed text-ink shadow-[var(--shadow-inset)] outline-none focus:border-cyan/50 focus:shadow-[var(--focus-ring)]"
                />
                {bodyJsonError && <div className="-mt-1 text-[11px] text-warm">Not valid JSON yet: {bodyJsonError}</div>}

                <SectionLabel>Response headers (JSON object, optional)</SectionLabel>
                <textarea
                  value={form.headersJson}
                  onChange={(e) => setForm({ ...form, headersJson: e.target.value })}
                  spellCheck={false}
                  rows={3}
                  placeholder={'{\n  "X-Request-Id": "{{uuid}}"\n}'}
                  className="resize-y rounded-2xl border border-rule bg-panel p-3 font-mono text-[12px] leading-relaxed text-ink shadow-[var(--shadow-inset)] outline-none focus:border-cyan/50 focus:shadow-[var(--focus-ring)]"
                />
                {headersError && <div className="-mt-1 text-[11px] text-rose">{headersError}</div>}

                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={save} disabled={!form.path.trim() || !!headersError}>
                    {editingId === 'new' ? 'Create route' : 'Save changes'}
                  </Button>
                  {editingId !== 'new' && (
                    <Button variant="default" onClick={duplicate}>
                      <CopyIcon size={13} weight="light" /> Duplicate
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setEditingId(null)}>Close</Button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-rule-soft bg-panel p-3.5">
                  <SectionLabel>Try it</SectionLabel>
                  {editingId === 'new' ? (
                    <div className="text-xs text-ink-faint">Create the route first, then send a test request from here.</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <MethodBadge method={form.method === 'ANY' ? 'GET' : form.method} />
                        <input
                          aria-label="Test request path"
                          className="devtools-input flex-1 py-1.5 font-mono text-xs"
                          value={testPath}
                          onChange={(e) => setTestPath(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && sendTest()}
                        />
                        <Button variant="default" className="py-1.5 text-xs" onClick={sendTest} disabled={testing}>
                          <PaperPlaneRight size={12} weight="light" /> {testing ? 'Sending…' : 'Send'}
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-faint">
                        <span className="truncate font-mono">{shareUrl}{testPath}</span>
                        <CopyButton text={`${shareUrl}${testPath}`} label="" />
                      </div>
                      {testResult && (
                        <div className="mt-2 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <StatusText status={testResult.status} strong />
                            <span className="text-ink-faint">{testResult.ms} ms</span>
                          </div>
                          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-rule-soft bg-surface p-3 font-mono text-[11.5px] text-ink">
                            {testResult.body || '(empty body)'}
                          </pre>
                          {testResult.headers.length > 0 && (
                            <details className="text-[11px] text-ink-faint">
                              <summary className="cursor-pointer">Response headers ({testResult.headers.length})</summary>
                              <div className="mt-1 font-mono">
                                {testResult.headers.map(([k, v]) => (
                                  <div key={k}><span className="text-ink-soft">{k}:</span> {v}</div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-rule-soft p-3.5">
                  <SectionLabel>Templates</SectionLabel>
                  <div className="flex flex-col gap-1.5">
                    {TEMPLATE_HELP.map(([code, desc]) => (
                      <div key={code} className="flex flex-wrap items-baseline gap-x-2 text-[11.5px]">
                        <code className="font-mono text-cyan">{code}</code>
                        <span className="text-ink-faint">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

function EmptyState({ shareUrl, onNew, lanAvailable }: { shareUrl: string; onNew: () => void; lanAvailable: boolean }) {
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-4 py-8">
      <div>
        <div className="text-base font-semibold tracking-tight text-ink">Serve fake APIs to any device</div>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Every route below answers at <span className="font-mono text-ink">{shareUrl}/…</span>
          {lanAvailable ? ' — phones, tablets and other laptops on the same Wi-Fi can call it directly.' : '.'} Cross-origin
          calls work out of the box (CORS preflights are answered), so a React/Angular dev server on another port or machine can use it too.
        </p>
      </div>
      <ol className="flex flex-col gap-2 text-[13px] text-ink-soft">
        <li><span className="mr-2 font-mono text-ink-faint">1</span>Create a route — pick a method, path, status and body.</li>
        <li><span className="mr-2 font-mono text-ink-faint">2</span>Open the URL or scan the QR code from your phone.</li>
        <li><span className="mr-2 font-mono text-ink-faint">3</span>Watch the Request log to see exactly what each device sent.</li>
      </ol>
      <div className="rounded-2xl border border-rule-soft bg-panel p-3.5 text-[12px] leading-relaxed text-ink-soft">
        <span className="font-medium text-ink">Can't connect from another device?</span> Both devices must be on the same network, and the
        OS firewall must allow Java to accept connections on port 8383 — on Windows, allow <span className="font-mono">java.exe</span> for
        Private networks when prompted (or in Windows Defender Firewall → Allow an app). Only <span className="font-mono">/mock/**</span> is
        shared; the rest of Dev Tools (Vault, files, SQL…) refuses requests from other machines.
      </div>
      <div>
        <Button variant="primary" onClick={onNew}>
          <Plus size={13} weight="bold" /> New route
        </Button>
      </div>
    </div>
  )
}

function RequestLog({
  log,
  routes,
  expanded,
  onExpand,
  onClear,
  unmatchedCount,
}: {
  log: MockLogEntry[]
  routes: MockRoute[]
  expanded: number | null
  onExpand: (seq: number | null) => void
  onClear: () => void
  unmatchedCount: number
}) {
  const routeById = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes])
  if (log.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-sm text-ink-faint">
        No requests yet.
        <span className="text-xs">Hits on /mock/** from any device show up here live.</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] text-ink-faint">
        <span>Last {log.length} requests</span>
        {unmatchedCount > 0 && <span className="text-warm">· {unmatchedCount} matched no route</span>}
        <button onClick={onClear} className="ml-auto flex items-center gap-1 hover:text-rose">
          <Broom size={12} weight="light" /> Clear
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-rule-soft">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-panel text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">From</th>
              <th className="px-3 py-2 font-medium">Request</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">ms</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e) => {
              const route = e.routeId !== null ? routeById.get(e.routeId) : undefined
              const local = e.remoteAddr === '127.0.0.1' || e.remoteAddr === '0:0:0:0:0:0:0:1' || e.remoteAddr === '::1'
              return (
                <Fragment key={e.seq}>
                  <tr className="cursor-pointer border-t border-rule-soft hover:bg-glass" onClick={() => onExpand(expanded === e.seq ? null : e.seq)}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-ink-faint">{new Date(e.at).toLocaleTimeString()}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-ink-soft">
                      {local ? <span className="text-ink-faint">this machine</span> : e.remoteAddr}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="mr-2"><MethodBadge method={e.method} /></span>
                      <span className="font-mono text-ink">{e.path}{e.query ? `?${e.query}` : ''}</span>
                      {!route && <span className="ml-2 text-[10.5px] text-warm">no match</span>}
                    </td>
                    <td className="px-3 py-1.5"><StatusText status={e.status} /></td>
                    <td className="px-3 py-1.5 text-right font-mono text-ink-faint">{e.durationMs}</td>
                  </tr>
                  {expanded === e.seq && (
                    <tr className="border-t border-rule-soft bg-panel">
                      <td colSpan={5} className="px-3 py-2.5 text-[11.5px]">
                        <div className="grid gap-1 text-ink-soft">
                          {route && <div>Matched <span className="font-mono text-ink">{route.method} {route.path}</span></div>}
                          {e.origin && <div>Origin <span className="font-mono text-ink">{e.origin}</span></div>}
                          {e.userAgent && <div className="truncate">User-Agent <span className="font-mono text-ink-faint">{e.userAgent}</span></div>}
                          {e.requestBody && (
                            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-rule-soft bg-surface p-2.5 font-mono text-ink">{e.requestBody}</pre>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QrStrip({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    // Always black-on-white regardless of theme: phone cameras decode that most reliably.
    QRCode.toDataURL(url, { margin: 1, width: 176, color: { dark: '#000000', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
  }, [url])
  return (
    <div className="flex shrink-0 items-center gap-4 border-b border-rule-soft bg-panel px-4 py-3">
      {dataUrl && <img src={dataUrl} alt={`QR code for ${url}`} className="h-28 w-28 rounded-lg bg-white p-1 ring-1 ring-rule" />}
      <div className="min-w-0 text-xs text-ink-soft">
        <div className="font-medium text-ink">Scan from a phone on the same Wi-Fi</div>
        <div className="mt-1 break-all font-mono text-ink-faint">{url}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
      {label}
      {children}
    </label>
  )
}

function IconBtn({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-1.5 transition-colors disabled:opacity-35 ${active ? 'bg-glass-strong text-cyan' : 'text-ink-faint hover:bg-glass hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

export function MethodBadge({ method }: { method: string }) {
  const color: Record<string, string> = {
    GET: 'bg-cyan/12 text-cyan',
    POST: 'bg-emerald/12 text-emerald',
    PUT: 'bg-warm/12 text-warm',
    PATCH: 'bg-violet/12 text-violet',
    DELETE: 'bg-rose/12 text-rose',
  }
  return (
    <span className={`inline-block w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold ${color[method] ?? 'bg-glass-strong text-ink-soft'}`}>
      {method}
    </span>
  )
}

function StatusText({ status, strong }: { status: number; strong?: boolean }) {
  const tone = status === 0 ? 'text-rose' : status < 300 ? 'text-emerald' : status < 400 ? 'text-cyan' : status < 500 ? 'text-warm' : 'text-rose'
  return <span className={`font-mono ${tone} ${strong ? 'font-semibold' : ''}`}>{status === 0 ? 'failed' : status}</span>
}
