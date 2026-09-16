import { useEffect, useState } from 'react'
import { Plus, Trash, Play } from '@phosphor-icons/react'
import {
  createMockRoute,
  deleteMockRoute,
  listMockRoutes,
  updateMockRoute,
  type MockRoute,
  type MockRouteSave,
} from '../lib/mockServerApi'
import { Button, Panel, SectionLabel, ErrorBanner, Toggle, CopyButton } from '../components/ui'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY']

const EMPTY: MockRouteSave = { method: 'GET', path: '/users/{id}', status: 200, responseBody: '{\n  "ok": true\n}', contentType: 'application/json', delayMs: 0, enabled: true }

export function MockServerPage() {
  const [routes, setRoutes] = useState<MockRoute[]>([])
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<MockRouteSave>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => listMockRoutes().then(setRoutes).catch((e) => setError(e.message))
  useEffect(() => { refresh() }, [])

  function startNew() {
    setForm(EMPTY)
    setEditingId('new')
  }

  function startEdit(r: MockRoute) {
    setForm({ method: r.method, path: r.path, status: r.status, responseBody: r.responseBody ?? '', contentType: r.contentType, delayMs: r.delayMs, enabled: r.enabled })
    setEditingId(r.id)
  }

  async function save() {
    if (!form.path.trim()) return
    setError(null)
    try {
      if (editingId === 'new') await createMockRoute(form)
      else if (typeof editingId === 'number') await updateMockRoute(editingId, form)
      setEditingId(null)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function toggleEnabled(r: MockRoute) {
    await updateMockRoute(r.id, { method: r.method, path: r.path, status: r.status, responseBody: r.responseBody ?? '', contentType: r.contentType, delayMs: r.delayMs, enabled: !r.enabled })
    refresh()
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this mock route?')) return
    await deleteMockRoute(id)
    refresh()
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="flex h-full gap-4">
      <Panel className="flex w-96 shrink-0 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-1 overflow-auto p-3">
          <div className="flex items-center justify-between px-1">
            <SectionLabel>Mock routes</SectionLabel>
            <button onClick={startNew} className="text-ink-faint hover:text-cyan"><Plus size={14} weight="bold" /></button>
          </div>
          {error && <ErrorBanner message={error} />}
          {routes.map((r) => (
            <div key={r.id} className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-glass">
              <span className="w-12 shrink-0 font-mono text-[10px] font-semibold text-cyan">{r.method}</span>
              <button onClick={() => startEdit(r)} className={`flex-1 truncate text-left font-mono ${r.enabled ? 'text-ink' : 'text-ink-faint line-through'}`}>{r.path}</button>
              <Toggle checked={r.enabled} onChange={() => toggleEnabled(r)} label="" />
              <Trash size={12} weight="light" className="shrink-0 opacity-0 hover:text-rose group-hover:opacity-100" onClick={() => remove(r.id)} />
            </div>
          ))}
          {routes.length === 0 && <div className="px-2 py-1 text-xs text-ink-faint">No mock routes yet.</div>}
        </div>
      </Panel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
          {editingId === null ? (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">
              Mock responses are served on this same app at <span className="mx-1 font-mono text-ink-soft">{origin}/mock/...</span> — pick or add a route.
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-2xl border border-rule bg-panel p-4">
              <SectionLabel>{editingId === 'new' ? 'New mock route' : 'Edit mock route'}</SectionLabel>
              <div className="flex items-center gap-2">
                <select className="devtools-input w-auto font-mono text-xs" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input className="devtools-input flex-1 font-mono text-xs" placeholder="/users/{id}" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
                  Status
                  <input type="number" className="devtools-input w-24 font-mono" value={form.status} onChange={(e) => setForm({ ...form, status: Number(e.target.value) })} />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
                  Content-Type
                  <input className="devtools-input w-48 font-mono" value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
                  Delay (ms)
                  <input type="number" className="devtools-input w-24 font-mono" value={form.delayMs} onChange={(e) => setForm({ ...form, delayMs: Number(e.target.value) })} />
                </label>
              </div>
              <SectionLabel>Response body</SectionLabel>
              <textarea
                value={form.responseBody}
                onChange={(e) => setForm({ ...form, responseBody: e.target.value })}
                spellCheck={false}
                rows={10}
                className="resize-none rounded-2xl border border-rule bg-void/20 p-3 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-cyan/50"
              />
              <div className="flex gap-2">
                <Button variant="primary" onClick={save} disabled={!form.path.trim()}>Save</Button>
                <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                {editingId !== 'new' && (
                  <div className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-faint">
                    <Play size={12} weight="light" />
                    <span className="font-mono">{origin}/mock{form.path}</span>
                    <CopyButton text={`${origin}/mock${form.path}`} label="" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
