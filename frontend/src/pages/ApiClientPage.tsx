import { useEffect, useMemo, useState } from 'react'
import { CaretDown, FloppyDisk, PaperPlaneTilt, Plus, Trash } from '@phosphor-icons/react'
import {
  createCollection,
  deleteCollection,
  deleteEnvironment,
  deleteRequest,
  executeRequest,
  listCollections,
  listEnvironments,
  listRequests,
  saveEnvironment,
  saveRequest,
  updateEnvironment,
  updateRequest,
  type ApiCollection,
  type ApiEnvironment,
  type ApiRequestDef,
  type ExecuteResponse,
  type HeaderKV,
} from '../lib/apiClientApi'
import { Button, Panel, SectionLabel, ErrorBanner, CopyButton } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--emerald)', POST: 'var(--cyan)', PUT: 'var(--warm)', PATCH: 'var(--warm)', DELETE: 'var(--rose)', HEAD: 'var(--violet)', OPTIONS: 'var(--violet)',
}

function parseVars(json: string | null | undefined): Record<string, string> {
  try {
    return json ? JSON.parse(json) : {}
  } catch {
    return {}
  }
}

/** Replaces {{varName}} tokens with the active environment's values — unresolved tokens are left as-is so a typo is obvious rather than silently becoming empty. */
function applyVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => (key in vars ? vars[key] : match))
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald'
  if (status >= 300 && status < 400) return 'text-cyan'
  if (status >= 400 && status < 500) return 'text-warm'
  if (status >= 500) return 'text-rose'
  return 'text-ink-faint'
}

export function ApiClientPage() {
  const [collections, setCollections] = useState<ApiCollection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null)
  const [requests, setRequests] = useState<ApiRequestDef[]>([])
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)

  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('https://')
  const [headers, setHeaders] = useState<HeaderKV[]>([{ key: '', value: '' }])
  const [body, setBody] = useState('')
  const [requestName, setRequestName] = useState('')

  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body')
  const [response, setResponse] = useState<ExecuteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const [environments, setEnvironments] = useState<ApiEnvironment[]>([])
  const [activeEnvId, setActiveEnvId] = useState<number | null>(null)
  const [envEditorOpen, setEnvEditorOpen] = useState(false)
  const [envEditing, setEnvEditing] = useState<ApiEnvironment | 'new' | null>(null)
  const [envName, setEnvName] = useState('')
  const [envVars, setEnvVars] = useState<HeaderKV[]>([{ key: '', value: '' }])

  const refreshCollections = () => listCollections().then((c) => {
    setCollections(c)
    if (selectedCollectionId == null && c.length > 0) setSelectedCollectionId(c[0].id)
  })
  useEffect(() => { refreshCollections() }, [])

  useEffect(() => {
    if (selectedCollectionId == null) { setRequests([]); setEnvironments([]); setActiveEnvId(null); return }
    listRequests(selectedCollectionId).then(setRequests)
    listEnvironments(selectedCollectionId).then((envs) => {
      setEnvironments(envs)
      setActiveEnvId((prev) => (prev != null && envs.some((e) => e.id === prev) ? prev : envs[0]?.id ?? null))
    })
  }, [selectedCollectionId])

  const activeVars = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId)
    return env ? parseVars(env.variablesJson) : {}
  }, [environments, activeEnvId])

  function refreshEnvironments(collectionId: number) {
    listEnvironments(collectionId).then(setEnvironments)
  }

  function startNewEnv() {
    setEnvEditing('new')
    setEnvName('')
    setEnvVars([{ key: '', value: '' }])
  }

  function startEditEnv(env: ApiEnvironment) {
    setEnvEditing(env)
    setEnvName(env.name)
    const vars = parseVars(env.variablesJson)
    const rows = Object.entries(vars).map(([key, value]) => ({ key, value }))
    setEnvVars(rows.length ? [...rows, { key: '', value: '' }] : [{ key: '', value: '' }])
  }

  function updateEnvVar(i: number, patch: Partial<HeaderKV>) {
    setEnvVars((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      if (i === next.length - 1 && (next[i].key || next[i].value)) next.push({ key: '', value: '' })
      return next
    })
  }

  async function saveEnv() {
    if (selectedCollectionId == null || !envName.trim()) return
    const varsObj: Record<string, string> = {}
    for (const v of envVars) if (v.key.trim()) varsObj[v.key.trim()] = v.value
    const payload = { collectionId: selectedCollectionId, name: envName.trim(), variablesJson: JSON.stringify(varsObj) }
    const saved = envEditing !== 'new' && envEditing ? await updateEnvironment(envEditing.id, payload) : await saveEnvironment(payload)
    refreshEnvironments(selectedCollectionId)
    setActiveEnvId(saved.id)
    setEnvEditing(null)
  }

  async function removeEnv(id: number) {
    if (!window.confirm('Delete this environment?')) return
    await deleteEnvironment(id)
    if (selectedCollectionId != null) refreshEnvironments(selectedCollectionId)
    if (activeEnvId === id) setActiveEnvId(null)
    if (envEditing !== 'new' && envEditing?.id === id) setEnvEditing(null)
  }

  async function addCollection() {
    const name = window.prompt('Collection name')
    if (!name) return
    const c = await createCollection(name)
    await refreshCollections()
    setSelectedCollectionId(c.id)
  }

  async function removeCollection(id: number) {
    if (!window.confirm('Delete this collection and all its saved requests?')) return
    await deleteCollection(id)
    if (selectedCollectionId === id) setSelectedCollectionId(null)
    refreshCollections()
  }

  function loadRequest(r: ApiRequestDef) {
    setSelectedRequestId(r.id)
    setRequestName(r.name)
    setMethod(r.method)
    setUrl(r.url)
    setBody(r.body ?? '')
    try {
      const parsed = r.headersJson ? (JSON.parse(r.headersJson) as HeaderKV[]) : []
      setHeaders(parsed.length ? parsed : [{ key: '', value: '' }])
    } catch {
      setHeaders([{ key: '', value: '' }])
    }
    setResponse(null)
    setError(null)
  }

  function newRequest() {
    setSelectedRequestId(null)
    setRequestName('')
    setMethod('GET')
    setUrl('https://')
    setHeaders([{ key: '', value: '' }])
    setBody('')
    setResponse(null)
    setError(null)
  }

  async function removeRequest(id: number) {
    if (!window.confirm('Delete this saved request?')) return
    await deleteRequest(id)
    if (selectedRequestId === id) newRequest()
    if (selectedCollectionId != null) listRequests(selectedCollectionId).then(setRequests)
  }

  async function save() {
    if (selectedCollectionId == null || !requestName.trim()) return
    const payload = { collectionId: selectedCollectionId, name: requestName.trim(), method, url, headersJson: JSON.stringify(headers.filter((h) => h.key.trim())), body }
    const saved = selectedRequestId != null ? await updateRequest(selectedRequestId, payload) : await saveRequest(payload)
    setSelectedRequestId(saved.id)
    listRequests(selectedCollectionId).then(setRequests)
  }

  async function send() {
    setSending(true)
    setError(null)
    try {
      const resolvedUrl = applyVars(url, activeVars)
      const resolvedHeaders = headers.filter((h) => h.key.trim()).map((h) => ({ key: applyVars(h.key, activeVars), value: applyVars(h.value, activeVars) }))
      const resolvedBody = applyVars(body, activeVars)
      const result = await executeRequest({ method, url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody })
      setResponse(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      setResponse(null)
    } finally {
      setSending(false)
    }
  }

  function updateHeader(i: number, patch: Partial<HeaderKV>) {
    setHeaders((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      if (i === next.length - 1 && (next[i].key || next[i].value)) next.push({ key: '', value: '' })
      return next
    })
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="api-client" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-1 p-2">
            <div className="flex items-center justify-between px-1">
              <SectionLabel>Collections</SectionLabel>
              <button onClick={addCollection} className="text-ink-faint hover:text-cyan"><Plus size={12} weight="bold" /></button>
            </div>
            {collections.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCollectionId(c.id)}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs ${selectedCollectionId === c.id ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
              >
                <span className="flex-1 truncate">{c.name}</span>
                <Trash size={11} weight="light" className="shrink-0 opacity-0 hover:text-rose group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeCollection(c.id) }} />
              </button>
            ))}
            {collections.length === 0 && <div className="px-2 py-1 text-xs text-ink-faint">No collections yet.</div>}
          </div>
        </Panel>

        <Panel className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-1 overflow-auto p-2">
            <div className="flex items-center justify-between px-1">
              <SectionLabel>Requests</SectionLabel>
              <button onClick={newRequest} className="text-ink-faint hover:text-cyan" title="New request"><Plus size={12} weight="bold" /></button>
            </div>
            {requests.map((r) => (
              <button
                key={r.id}
                onClick={() => loadRequest(r)}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs ${selectedRequestId === r.id ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
              >
                <span className="w-12 shrink-0 font-mono text-[10px] font-semibold" style={{ color: METHOD_COLOR[r.method] }}>{r.method}</span>
                <span className="flex-1 truncate">{r.name}</span>
                <Trash size={11} weight="light" className="shrink-0 opacity-0 hover:text-rose group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeRequest(r.id) }} />
              </button>
            ))}
            {selectedCollectionId != null && requests.length === 0 && <div className="px-2 py-1 text-xs text-ink-faint">No saved requests.</div>}
          </div>
        </Panel>
      </ResizablePanel>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        <Panel>
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="devtools-input shrink-0 font-mono text-xs font-semibold"
                style={{ color: METHOD_COLOR[method], width: '108px' }}
              >
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input
                className="devtools-input min-w-0 flex-1 font-mono text-xs"
                placeholder="https://api.example.com/resource"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <Button variant="primary" onClick={send} disabled={!url.trim() || sending}>
                <PaperPlaneTilt size={13} weight="light" /> {sending ? 'Sending…' : 'Send'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="devtools-input flex-1 text-xs"
                placeholder="Request name (to save)"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
              />
              <Button variant="default" onClick={save} disabled={selectedCollectionId == null || !requestName.trim()}>
                <FloppyDisk size={13} weight="light" /> Save
              </Button>
              <div className="relative">
                <button
                  onClick={() => setEnvEditorOpen((o) => !o)}
                  disabled={selectedCollectionId == null}
                  className="flex items-center gap-1.5 rounded-full bg-glass px-3 py-2 text-xs text-ink-soft ring-1 ring-glass-strong hover:bg-glass-strong disabled:opacity-35"
                >
                  {environments.find((e) => e.id === activeEnvId)?.name ?? 'No environment'}
                  <CaretDown size={11} weight="bold" />
                </button>
                {envEditorOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-2xl border border-rule bg-surface p-3 shadow-[var(--shadow-pop)]">
                    <div className="mb-2 flex items-center justify-between">
                      <SectionLabel>Environments</SectionLabel>
                      <button onClick={startNewEnv} className="text-ink-faint hover:text-cyan"><Plus size={12} weight="bold" /></button>
                    </div>
                    <div className="mb-2 flex flex-col gap-1">
                      <button
                        onClick={() => setActiveEnvId(null)}
                        className={`rounded-lg px-2.5 py-1.5 text-left text-xs ${activeEnvId === null ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
                      >
                        No environment (raw {'{{vars}}'})
                      </button>
                      {environments.map((env) => (
                        <div key={env.id} className={`group flex items-center gap-1.5 rounded-lg px-1 ${activeEnvId === env.id ? 'bg-glass-strong' : 'hover:bg-glass'}`}>
                          <button onClick={() => setActiveEnvId(env.id)} className={`flex-1 truncate px-1.5 py-1.5 text-left text-xs ${activeEnvId === env.id ? 'text-ink' : 'text-ink-faint'}`}>
                            {env.name}
                          </button>
                          <button onClick={() => startEditEnv(env)} className="rounded px-1.5 py-1 text-[10px] text-ink-faint opacity-0 hover:text-cyan group-hover:opacity-100">Edit</button>
                          <Trash size={11} weight="light" className="mr-1 shrink-0 text-ink-faint opacity-0 hover:text-rose group-hover:opacity-100" onClick={() => removeEnv(env.id)} />
                        </div>
                      ))}
                      {environments.length === 0 && <div className="px-2 py-1 text-[11px] text-ink-faint">No environments yet.</div>}
                    </div>

                    {envEditing !== null && (
                      <div className="flex flex-col gap-2 border-t border-rule-soft pt-2">
                        <input className="devtools-input text-xs" placeholder="Environment name (e.g. Dev, Prod)" value={envName} onChange={(e) => setEnvName(e.target.value)} />
                        <div className="flex max-h-40 flex-col gap-1.5 overflow-auto">
                          {envVars.map((v, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <input className="devtools-input flex-1 font-mono text-[11px]" placeholder="varName" value={v.key} onChange={(e) => updateEnvVar(i, { key: e.target.value })} />
                              <input className="devtools-input flex-1 font-mono text-[11px]" placeholder="value" value={v.value} onChange={(e) => updateEnvVar(i, { value: e.target.value })} />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <Button variant="primary" onClick={saveEnv} disabled={!envName.trim()} className="flex-1 justify-center py-1.5 text-xs">Save</Button>
                          <Button variant="ghost" onClick={() => setEnvEditing(null)} className="py-1.5 text-xs">Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
          <Panel className="flex flex-col overflow-hidden">
            <div className="flex flex-1 flex-col gap-2 overflow-auto p-3">
              <SectionLabel>Headers</SectionLabel>
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className="devtools-input flex-1 font-mono text-[11px]" placeholder="Header" value={h.key} onChange={(e) => updateHeader(i, { key: e.target.value })} />
                  <input className="devtools-input flex-1 font-mono text-[11px]" placeholder="Value" value={h.value} onChange={(e) => updateHeader(i, { value: e.target.value })} />
                </div>
              ))}
              <SectionLabel>Body</SectionLabel>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
                placeholder="Request body (JSON, XML, plain text…)"
                className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-cyan/50"
              />
            </div>
          </Panel>

          <Panel className="flex flex-col overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden p-3">
              {error && <ErrorBanner message={error} />}
              {!error && !response && (
                <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">Send a request to see the response.</div>
              )}
              {response && (
                <>
                  <div className="mb-2 flex items-center gap-3 text-xs">
                    <span className={`font-mono font-semibold ${statusColor(response.status)}`}>{response.status} {response.statusText}</span>
                    <span className="text-ink-faint">{response.durationMs}ms</span>
                    <span className="text-ink-faint">{response.bodyBytes} B</span>
                    <div className="ml-auto flex gap-1 rounded-lg border border-rule bg-panel p-0.5">
                      <button onClick={() => setResponseTab('body')} className={`rounded-md px-2 py-1 text-[10.5px] font-medium ${responseTab === 'body' ? 'bg-glass-strong text-ink' : 'text-ink-faint'}`}>Body</button>
                      <button onClick={() => setResponseTab('headers')} className={`rounded-md px-2 py-1 text-[10.5px] font-medium ${responseTab === 'headers' ? 'bg-glass-strong text-ink' : 'text-ink-faint'}`}>Headers</button>
                    </div>
                    <CopyButton text={responseTab === 'body' ? response.body : JSON.stringify(response.headers, null, 2)} />
                  </div>
                  <div className="flex-1 overflow-auto rounded-2xl border border-rule bg-panel p-3">
                    {responseTab === 'body' ? (
                      <pre className="whitespace-pre-wrap break-all font-mono text-[12px] text-ink-soft">{response.body || '—'}</pre>
                    ) : (
                      <div className="flex flex-col gap-1 font-mono text-[11.5px] text-ink-soft">
                        {Object.entries(response.headers).map(([k, v]) => (
                          <div key={k}>{k}: <span className="text-ink-faint">{v}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
