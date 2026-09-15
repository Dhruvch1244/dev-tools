import { useEffect, useMemo, useState } from 'react'
import { Copy, Eye, EyeSlash, Plus, Trash, LockKey } from '@phosphor-icons/react'
import { createVaultEntry, deleteVaultEntry, listVaultEntries, updateVaultEntry, type VaultEntry, type VaultRequest } from '../lib/vaultApi'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'

const EMPTY: VaultRequest = { environment: '', name: '', url: '', username: '', secret: '', notes: '' }

export function VaultPage() {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [envFilter, setEnvFilter] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<VaultRequest>(EMPTY)

  const refresh = () => listVaultEntries().then(setEntries).catch((e) => setError(e.message))
  useEffect(() => { refresh() }, [])

  const environments = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) set.add(e.environment)
    return Array.from(set).sort()
  }, [entries])

  const visible = useMemo(
    () => (envFilter ? entries.filter((e) => e.environment === envFilter) : entries),
    [entries, envFilter]
  )

  function toggleReveal(id: number) {
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function copySecret(secret: string) {
    await navigator.clipboard.writeText(secret)
  }

  function startNew() {
    setForm({ ...EMPTY, environment: envFilter ?? '' })
    setEditingId('new')
  }

  function startEdit(e: VaultEntry) {
    setForm({ environment: e.environment, name: e.name, url: e.url ?? '', username: e.username ?? '', secret: e.secret, notes: e.notes ?? '' })
    setEditingId(e.id)
  }

  async function save() {
    if (!form.environment.trim() || !form.name.trim() || !form.secret.trim()) return
    setError(null)
    try {
      if (editingId === 'new') await createVaultEntry(form)
      else if (typeof editingId === 'number') await updateVaultEntry(editingId, form)
      setEditingId(null)
      setForm(EMPTY)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function remove(id: number, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return
    await deleteVaultEntry(id)
    refresh()
  }

  return (
    <div className="flex h-full gap-4">
      <Panel className="flex w-56 shrink-0 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-1 overflow-auto p-3">
          <SectionLabel>Environments</SectionLabel>
          <button
            onClick={() => setEnvFilter(null)}
            className={`rounded-lg px-2.5 py-1.5 text-left text-xs ${envFilter === null ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
          >
            All ({entries.length})
          </button>
          {environments.map((env) => (
            <button
              key={env}
              onClick={() => setEnvFilter(env)}
              className={`rounded-lg px-2.5 py-1.5 text-left text-xs ${envFilter === env ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
            >
              {env} ({entries.filter((e) => e.environment === env).length})
            </button>
          ))}
          <Button variant="primary" onClick={startNew} className="mt-2">
            <Plus size={14} weight="bold" /> Add entry
          </Button>
        </div>
      </Panel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
          {error && <ErrorBanner message={error} />}

          {editingId !== null && (
            <div className="flex flex-col gap-2 rounded-2xl border border-rule bg-panel p-4">
              <SectionLabel>{editingId === 'new' ? 'New entry' : 'Edit entry'}</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="devtools-input"
                  placeholder="Environment (e.g. DIT, SIT, UAT, PROD)"
                  value={form.environment}
                  onChange={(e) => setForm({ ...form, environment: e.target.value })}
                />
                <input
                  className="devtools-input"
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className="devtools-input col-span-2"
                  placeholder="URL (optional)"
                  value={form.url ?? ''}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
                <input
                  className="devtools-input"
                  placeholder="Username (optional)"
                  value={form.username ?? ''}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
                <input
                  type="password"
                  className="devtools-input font-mono"
                  placeholder="Secret / password / token"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                />
                <textarea
                  className="devtools-input col-span-2 resize-none font-mono text-xs"
                  rows={2}
                  placeholder="Notes (optional)"
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={save} disabled={!form.environment.trim() || !form.name.trim() || !form.secret.trim()}>
                  Save
                </Button>
                <Button variant="ghost" onClick={() => { setEditingId(null); setForm(EMPTY) }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {visible.length === 0 && editingId === null && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-ink-faint">
              <LockKey size={28} weight="light" />
              No entries yet — add credentials, URLs, and secrets per environment.
            </div>
          )}

          <div className="flex flex-col gap-2">
            {visible.map((e) => (
              <div key={e.id} className="group flex flex-col gap-1.5 rounded-xl border border-rule-soft bg-glass px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-glass-strong px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan">
                    {e.environment}
                  </span>
                  <span className="text-sm font-medium text-ink">{e.name}</span>
                  <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => startEdit(e)} className="rounded-md px-2 py-1 text-[10.5px] text-ink-faint hover:bg-glass-strong hover:text-ink">
                      Edit
                    </button>
                    <button onClick={() => remove(e.id, e.name)} className="rounded-md p-1 text-ink-faint hover:text-rose">
                      <Trash size={13} weight="light" />
                    </button>
                  </div>
                </div>
                {e.url && (
                  <a href={e.url} target="_blank" rel="noreferrer" className="truncate text-[11.5px] text-cyan hover:underline">
                    {e.url}
                  </a>
                )}
                {e.username && <div className="text-[11.5px] text-ink-soft">user: <span className="font-mono">{e.username}</span></div>}
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 truncate rounded-lg bg-panel px-2.5 py-1.5 font-mono text-[12px] text-ink">
                    {revealed.has(e.id) ? e.secret : '•'.repeat(Math.min(24, Math.max(8, e.secret.length)))}
                  </span>
                  <button onClick={() => toggleReveal(e.id)} className="rounded-md p-1.5 text-ink-faint hover:bg-glass-strong hover:text-ink" title={revealed.has(e.id) ? 'Hide' : 'Reveal'}>
                    {revealed.has(e.id) ? <EyeSlash size={14} weight="light" /> : <Eye size={14} weight="light" />}
                  </button>
                  <button onClick={() => copySecret(e.secret)} className="rounded-md p-1.5 text-ink-faint hover:bg-glass-strong hover:text-ink" title="Copy secret">
                    <Copy size={14} weight="light" />
                  </button>
                </div>
                {e.notes && <div className="text-[11px] text-ink-faint">{e.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}
