import { useEffect, useMemo, useState } from 'react'
import { Copy, Eye, EyeSlash, Plus, Trash, LockKey, LockSimple, LockSimpleOpen, ShieldCheck } from '@phosphor-icons/react'
import {
  createVaultEntry,
  deleteVaultEntry,
  disableEncryption,
  enableEncryption,
  getEncryptionStatus,
  listVaultEntries,
  lockVault,
  rotatePassphrase,
  unlockVault,
  updateVaultEntry,
  type EncryptionStatus,
  type VaultEntry,
  type VaultRequest,
} from '../lib/vaultApi'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'

const EMPTY: VaultRequest = { environment: '', name: '', url: '', username: '', secret: '', notes: '' }

export function VaultPage() {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [envFilter, setEnvFilter] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<VaultRequest>(EMPTY)
  const [encStatus, setEncStatus] = useState<EncryptionStatus | null>(null)
  const [encBusy, setEncBusy] = useState(false)

  const refresh = () => listVaultEntries().then(setEntries).catch((e) => setError(e.message))
  const refreshEncStatus = () => getEncryptionStatus().then(setEncStatus).catch(() => {})
  useEffect(() => { refresh(); refreshEncStatus() }, [])

  const locked = encStatus?.enabled === true && encStatus.unlocked === false

  async function handleEnable() {
    const passphrase = window.prompt('Set a passphrase to encrypt all vault secrets. You will need it every time you restart the app.')
    if (!passphrase) return
    const confirmPass = window.prompt('Confirm the passphrase:')
    if (confirmPass !== passphrase) { setError('Passphrases did not match.'); return }
    setError(null)
    setEncBusy(true)
    try {
      await enableEncryption(passphrase)
      await refreshEncStatus()
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable encryption')
    } finally {
      setEncBusy(false)
    }
  }

  async function handleUnlock() {
    const passphrase = window.prompt('Enter the vault passphrase to unlock:')
    if (!passphrase) return
    setError(null)
    setEncBusy(true)
    try {
      await unlockVault(passphrase)
      await refreshEncStatus()
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock')
    } finally {
      setEncBusy(false)
    }
  }

  async function handleLock() {
    setEncBusy(true)
    try {
      await lockVault()
      await refreshEncStatus()
      refresh()
    } finally {
      setEncBusy(false)
    }
  }

  async function handleDisable() {
    const passphrase = window.prompt('Enter the current passphrase to disable encryption (all secrets will be stored as plaintext again):')
    if (!passphrase) return
    if (!window.confirm('Disable encryption and store all secrets as plaintext?')) return
    setError(null)
    setEncBusy(true)
    try {
      await disableEncryption(passphrase)
      await refreshEncStatus()
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disable encryption')
    } finally {
      setEncBusy(false)
    }
  }

  async function handleRotate() {
    const oldPass = window.prompt('Current passphrase:')
    if (!oldPass) return
    const newPass = window.prompt('New passphrase:')
    if (!newPass) return
    const confirmPass = window.prompt('Confirm new passphrase:')
    if (confirmPass !== newPass) { setError('New passphrases did not match.'); return }
    setError(null)
    setEncBusy(true)
    try {
      await rotatePassphrase(oldPass, newPass)
      await refreshEncStatus()
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change passphrase')
    } finally {
      setEncBusy(false)
    }
  }

  const environments = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) set.add(e.environment)
    return Array.from(set).sort()
  }, [entries])

  // Grouped by name (case-insensitive) so "Order API" in DIT/UAT/PROD shows as one card with
  // every environment side by side, instead of forcing you to flip the env filter to compare.
  const groups = useMemo(() => {
    const byName = new Map<string, VaultEntry[]>()
    for (const e of entries) {
      const key = e.name.trim().toLowerCase()
      const list = byName.get(key) ?? []
      list.push(e)
      byName.set(key, list)
    }
    const envOrder = (env: string) => environments.indexOf(env)
    const all = Array.from(byName.values()).map((list) => [...list].sort((a, b) => envOrder(a.environment) - envOrder(b.environment)))
    all.sort((a, b) => a[0].name.localeCompare(b[0].name))
    if (!envFilter) return all
    return all.filter((group) => group.some((e) => e.environment === envFilter))
  }, [entries, envFilter, environments])

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
    if (locked) { setError('Unlock the vault before adding entries.'); return }
    setForm({ ...EMPTY, environment: envFilter ?? '' })
    setEditingId('new')
  }

  function startEdit(e: VaultEntry) {
    if (locked || e.locked) { setError('Unlock the vault before editing entries.'); return }
    setForm({ environment: e.environment, name: e.name, url: e.url ?? '', username: e.username ?? '', secret: e.secret ?? '', notes: e.notes ?? '' })
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

        <div className="border-t border-rule-soft p-3">
          <SectionLabel>Encryption</SectionLabel>
          {!encStatus ? (
            <div className="mt-2 text-[10.5px] text-ink-faint">Loading…</div>
          ) : !encStatus.enabled ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="text-[10.5px] text-ink-faint">Secrets are stored as plaintext.</div>
              <Button variant="ghost" onClick={handleEnable} disabled={encBusy} className="w-full justify-start px-2.5 py-1.5 text-xs">
                <ShieldCheck size={13} weight="light" /> Enable encryption
              </Button>
            </div>
          ) : encStatus.unlocked ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10.5px] text-cyan">
                <LockSimpleOpen size={12} weight="bold" /> Unlocked
              </div>
              <Button variant="ghost" onClick={handleLock} disabled={encBusy} className="w-full justify-start px-2.5 py-1.5 text-xs">
                <LockSimple size={13} weight="light" /> Lock vault
              </Button>
              <Button variant="ghost" onClick={handleRotate} disabled={encBusy} className="w-full justify-start px-2.5 py-1.5 text-xs">
                Change passphrase
              </Button>
              <Button variant="ghost" onClick={handleDisable} disabled={encBusy} className="w-full justify-start px-2.5 py-1.5 text-xs text-rose">
                Disable encryption
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10.5px] text-warm">
                <LockSimple size={12} weight="bold" /> Locked
              </div>
              <Button variant="primary" onClick={handleUnlock} disabled={encBusy} className="w-full justify-start px-2.5 py-1.5 text-xs">
                <LockSimpleOpen size={13} weight="light" /> Unlock vault
              </Button>
            </div>
          )}
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

          {groups.length === 0 && editingId === null && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-ink-faint">
              <LockKey size={28} weight="light" />
              No entries yet — add credentials, URLs, and secrets per environment.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group[0].name.trim().toLowerCase()} className="rounded-xl border border-rule-soft bg-glass px-3.5 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{group[0].name}</span>
                  {group.length > 1 && <span className="text-[10.5px] text-ink-faint">{group.length} environments</span>}
                </div>
                <div className="flex flex-col gap-2">
                  {group.map((e) => (
                    <div key={e.id} className="group flex flex-col gap-1.5 rounded-lg border border-rule-soft bg-panel px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-glass-strong px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan">
                          {e.environment}
                        </span>
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noreferrer" className="truncate text-[11.5px] text-cyan hover:underline">
                            {e.url}
                          </a>
                        )}
                        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => startEdit(e)} className="rounded-md px-2 py-1 text-[10.5px] text-ink-faint hover:bg-glass-strong hover:text-ink">
                            Edit
                          </button>
                          <button onClick={() => remove(e.id, e.name)} className="rounded-md p-1 text-ink-faint hover:text-rose">
                            <Trash size={13} weight="light" />
                          </button>
                        </div>
                      </div>
                      {e.username && <div className="text-[11.5px] text-ink-soft">user: <span className="font-mono">{e.username}</span></div>}
                      <div className="flex items-center gap-1.5">
                        <span className="flex-1 truncate rounded-lg bg-glass px-2.5 py-1.5 font-mono text-[12px] text-ink">
                          {e.locked ? (
                            <span className="flex items-center gap-1.5 text-ink-faint"><LockSimple size={12} weight="bold" /> Locked — unlock the vault to view</span>
                          ) : revealed.has(e.id) ? (
                            e.secret
                          ) : (
                            '•'.repeat(Math.min(24, Math.max(8, (e.secret ?? '').length)))
                          )}
                        </span>
                        <button onClick={() => toggleReveal(e.id)} disabled={e.locked} className="rounded-md p-1.5 text-ink-faint hover:bg-glass-strong hover:text-ink disabled:opacity-30" title={revealed.has(e.id) ? 'Hide' : 'Reveal'}>
                          {revealed.has(e.id) ? <EyeSlash size={14} weight="light" /> : <Eye size={14} weight="light" />}
                        </button>
                        <button onClick={() => e.secret && copySecret(e.secret)} disabled={e.locked} className="rounded-md p-1.5 text-ink-faint hover:bg-glass-strong hover:text-ink disabled:opacity-30" title="Copy secret">
                          <Copy size={14} weight="light" />
                        </button>
                      </div>
                      {e.notes && <div className="text-[11px] text-ink-faint">{e.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}
