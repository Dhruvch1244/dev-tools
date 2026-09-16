import { useEffect, useState } from 'react'
import { FloppyDisk, PaperPlaneTilt, Plus, Trash } from '@phosphor-icons/react'
import {
  createCollection,
  deleteCollection,
  deleteRequest,
  executeRequest,
  listCollections,
  listRequests,
  saveRequest,
  updateRequest,
  type ApiCollection,
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

  const refreshCollections = () => listCollections().then((c) => {
    setCollections(c)
    if (selectedCollectionId == null && c.length > 0) setSelectedCollectionId(c[0].id)
  })
  useEffect(() => { refreshCollections() }, [])

  useEffect(() => {
    if (selectedCollectionId == null) { setRequests([]); return }
    listRequests(selectedCollectionId).then(setRequests)
  }, [selectedCollectionId])

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
      const result = await executeRequest({ method, url, headers: headers.filter((h) => h.key.trim()), body })
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
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="devtools-input w-auto font-mono text-xs font-semibold" style={{ color: METHOD_COLOR[method] }}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input
                className="devtools-input flex-1 font-mono text-xs"
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
