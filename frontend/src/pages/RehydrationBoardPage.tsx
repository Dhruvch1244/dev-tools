import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Camera,
  CircleNotch,
  DownloadSimple,
  GitDiff,
  Lightning,
  Plus,
  Rocket,
  Trash,
  Warning,
  X,
} from '@phosphor-icons/react'
import {
  createDoc,
  createRecord,
  deleteDoc,
  deleteRecord,
  fmtAgo,
  getQueueItem,
  listDocs,
  listRecords,
  listServers,
  requestOpenBuild,
  template,
  triggerBuild,
  type HelmRecord,
  type JenkinsServer,
  type JsonDoc,
} from '../lib/jenkinsApi'
import { Badge, Button, CodeOut, EmptyState, ErrorBanner, Field, Input, Panel, Segmented, Select, SectionLabel, StatTile } from '../components/ui'
import { celebrate } from '../components/CursorFx'

type Entry = { service: string; helmTag: string; chart?: string | null; namespace?: string | null; imageTag?: string | null }
type Snapshot = { environment: string; entries: Entry[] }
type Format = 'yaml' | 'json' | 'helm' | 'manifest' | 'env' | 'csv'
const ENV_ORDER = ['DEV', 'DIT', 'SIT', 'QA', 'UAT', 'PREPROD', 'STAGING', 'PERF', 'PROD', 'DR']

function envSort(a: string, b: string) {
  const ia = ENV_ORDER.indexOf(a)
  const ib = ENV_ORDER.indexOf(b)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
}

export function RehydrationBoardPage() {
  const [records, setRecords] = useState<HelmRecord[]>([])
  const [snapshots, setSnapshots] = useState<JsonDoc[]>([])
  const [servers, setServers] = useState<JenkinsServer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cell, setCell] = useState<{ service: string; env: string } | null>(null)
  const [exportEnv, setExportEnv] = useState('')
  const [format, setFormat] = useState<Format>('yaml')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ service: '', environment: '', helmTag: '', chart: '', namespace: '' })
  const [compare, setCompare] = useState<{ left: string; right: string }>({ left: '', right: '' })
  const [filter, setFilter] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s, sv] = await Promise.all([listRecords(), listDocs('snapshot'), listServers()])
      setRecords(r)
      setSnapshots(s)
      setServers(sv)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the board')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const envs = useMemo(() => Array.from(new Set(records.map((r) => r.environment))).sort(envSort), [records])
  const services = useMemo(
    () => Array.from(new Set(records.map((r) => r.service))).filter((s) => !filter || s.toLowerCase().includes(filter.toLowerCase())).sort(),
    [records, filter],
  )
  // records arrive newest-first, so the first one seen per (service, env) is the latest
  const latest = useMemo(() => {
    const m = new Map<string, HelmRecord>()
    for (const r of records) {
      const k = `${r.service}\u0000${r.environment}`
      if (!m.has(k)) m.set(k, r)
    }
    return m
  }, [records])
  const get = (service: string, env: string) => latest.get(`${service}\u0000${env}`)

  useEffect(() => {
    if (!exportEnv && envs.length) setExportEnv(envs[envs.length - 1])
    if (!compare.left && envs.length >= 2) setCompare({ left: `env:${envs[envs.length - 2]}`, right: `env:${envs[envs.length - 1]}` })
  }, [envs, exportEnv, compare.left])

  function entriesFor(env: string): Entry[] {
    return Array.from(new Set(records.map((r) => r.service)))
      .sort()
      .map((s) => get(s, env))
      .filter((r): r is HelmRecord => !!r)
      .map((r) => ({ service: r.service, helmTag: r.helmTag, chart: r.chart, namespace: r.namespace, imageTag: r.imageTag }))
  }

  function entriesForRef(ref: string): Entry[] {
    if (ref.startsWith('env:')) return entriesFor(ref.slice(4))
    const doc = snapshots.find((d) => `snap:${d.id}` === ref)
    if (!doc) return []
    try {
      return (JSON.parse(doc.body) as Snapshot).entries
    } catch {
      return []
    }
  }

  const drift = useMemo(() => {
    let count = 0
    for (const s of services) {
      const tags = new Set(envs.map((e) => get(s, e)?.helmTag).filter(Boolean))
      if (tags.size > 1) count++
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, envs, latest])

  async function addRecord() {
    try {
      await createRecord({ ...form, chart: form.chart || null, namespace: form.namespace || null })
      setForm({ service: '', environment: form.environment, helmTag: '', chart: '', namespace: '' })
      setAdding(false)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    }
  }

  async function snapshot(env: string) {
    const name = `${env} · ${new Date().toLocaleString()}`
    await createDoc('snapshot', name, { environment: env, entries: entriesFor(env) } satisfies Snapshot)
    refresh()
  }

  const exportEntries = exportEnv.startsWith('snap:') ? entriesForRef(exportEnv) : entriesFor(exportEnv)
  const exportLabel = exportEnv.startsWith('snap:') ? snapshots.find((d) => `snap:${d.id}` === exportEnv)?.name ?? '' : exportEnv
  const exportText = render(format, exportEntries, exportLabel)

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Services" value={new Set(records.map((r) => r.service)).size} />
        <StatTile label="Environments" value={envs.length} tone="violet" />
        <StatTile label="Drifting services" value={drift} tone={drift ? 'warm' : 'emerald'} hint="different tag across envs" />
        <StatTile label="Snapshots" value={snapshots.length} tone="rose" />
      </div>

      {error && <ErrorBanner message={error} />}

      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-display text-[1.75rem] text-ink">Helm tags by environment</div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter services" className="!w-52" />
              <Button onClick={() => setAdding((v) => !v)}><Plus size={15} weight="bold" /> Add tag</Button>
              <Button variant="ghost" onClick={refresh}><ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} /></Button>
            </div>
          </div>
          <AnimatePresence>
            {adding && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-rule-soft p-4 md:grid-cols-6">
                  <Field label="Service" className="md:col-span-2"><Input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} /></Field>
                  <Field label="Env"><Input value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Helm tag" className="md:col-span-2"><Input value={form.helmTag} onChange={(e) => setForm({ ...form, helmTag: e.target.value })} /></Field>
                  <Field label="Namespace"><Input value={form.namespace} onChange={(e) => setForm({ ...form, namespace: e.target.value })} /></Field>
                  <div className="md:col-span-6"><Button variant="primary" onClick={addRecord} disabled={!form.service || !form.environment || !form.helmTag}>Save</Button></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {records.length === 0 && !loading ? (
            <EmptyState icon={<Rocket size={44} weight="duotone" />} title="No helm tags captured yet">
              Run a CD build in Jenkins Pipeline Studio and hit “Get helm tag → Save”, or run a Release Flow — every tag lands here, per service and environment.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-rule-soft">
              <table className="w-full min-w-[40rem] text-left">
                <thead className="bg-glass">
                  <tr>
                    <th className="sticky left-0 bg-surface px-4 py-3 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-ink-faint">Service</th>
                    {envs.map((e) => (
                      <th key={e} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-[1.35rem] text-ink">{e}</span>
                          <button onClick={() => snapshot(e)} title={`Snapshot ${e}`} className="rounded-lg p-1 text-ink-faint hover:bg-glass hover:text-cyan"><Camera size={15} /></button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, i) => {
                    const tags = envs.map((e) => get(s, e)?.helmTag)
                    const drifting = new Set(tags.filter(Boolean)).size > 1
                    return (
                      <motion.tr key={s} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.5) }} className="border-t border-rule-soft">
                        <td className="sticky left-0 bg-surface px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.9375rem] font-semibold text-ink">{s}</span>
                            {drifting && <span title="Tag differs between environments"><Warning size={15} weight="fill" className="text-warm" /></span>}
                          </div>
                        </td>
                        {envs.map((e, j) => {
                          const r = get(s, e)
                          const prev = j > 0 ? get(s, envs[j - 1]) : undefined
                          const differs = !!(r && prev && r.helmTag !== prev.helmTag)
                          return (
                            <td key={e} className="px-3 py-2">
                              {r ? (
                                <button
                                  onClick={() => setCell({ service: s, env: e })}
                                  className={`w-full rounded-xl px-3 py-2 text-left ring-1 transition-transform hover:-translate-y-0.5 ${differs ? 'bg-warm/10 ring-warm/40' : 'bg-glass ring-rule-soft'}`}
                                >
                                  <div className="break-all font-mono text-[0.875rem] font-semibold text-ink">{r.helmTag}</div>
                                  <div className="text-[0.75rem] text-ink-faint">{fmtAgo(r.capturedAt)}{r.buildNumber ? ` · #${r.buildNumber}` : ''}</div>
                                </button>
                              ) : (
                                <span className="px-3 text-ink-faint">—</span>
                              )}
                            </td>
                          )
                        })}
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <AnimatePresence>
        {cell && (
          <HistoryDrawer
            service={cell.service}
            env={cell.env}
            records={records.filter((r) => r.service === cell.service && r.environment === cell.env)}
            servers={servers}
            onClose={() => setCell(null)}
            onDelete={async (id) => {
              await deleteRecord(id)
              refresh()
            }}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-display text-[1.6rem] text-ink">Export manifest</div>
              <Select value={exportEnv} onChange={(e) => setExportEnv(e.target.value)} className="ml-auto !w-auto">
                {envs.map((e) => <option key={e} value={e}>{e} (current)</option>)}
                {snapshots.map((d) => <option key={d.id} value={`snap:${d.id}`}>📸 {d.name}</option>)}
              </Select>
            </div>
            <Segmented
              id="rehydrate-format"
              size="sm"
              value={format}
              onChange={setFormat}
              options={[
                { id: 'yaml', label: 'YAML' },
                { id: 'json', label: 'JSON' },
                { id: 'helm', label: 'helm cmds' },
                { id: 'manifest', label: 'svc=tag' },
                { id: 'env', label: '.env' },
                { id: 'csv', label: 'CSV' },
              ]}
            />
            <CodeOut text={exportText} />
            <div>
              <Button
                variant="ghost"
                onClick={() => {
                  const blob = new Blob([exportText], { type: 'text/plain' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `rehydration-${exportLabel.replace(/[^\w.-]+/g, '_')}.${{ yaml: 'yaml', json: 'json', helm: 'sh', manifest: 'txt', env: 'env', csv: 'csv' }[format]}`
                  a.click()
                  URL.revokeObjectURL(a.href)
                }}
              >
                <DownloadSimple size={15} /> Download
              </Button>
            </div>
          </div>
        </Panel>

        <RehydratePanel servers={servers} entries={exportEntries} label={exportLabel} environment={exportEnv.startsWith('snap:') ? (() => { try { return (JSON.parse(snapshots.find((d) => `snap:${d.id}` === exportEnv)?.body ?? '{}') as Snapshot).environment } catch { return '' } })() : exportEnv} />
      </div>

      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <GitDiff size={22} className="text-cyan" />
            <div className="font-display text-[1.6rem] text-ink">Compare</div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {(['left', 'right'] as const).map((side) => (
                <Select key={side} value={compare[side]} onChange={(e) => setCompare({ ...compare, [side]: e.target.value })} className="!w-auto">
                  <option value="">—</option>
                  {envs.map((e) => <option key={e} value={`env:${e}`}>{e} (current)</option>)}
                  {snapshots.map((d) => <option key={d.id} value={`snap:${d.id}`}>📸 {d.name}</option>)}
                </Select>
              ))}
            </div>
          </div>
          <DiffTable left={entriesForRef(compare.left)} right={entriesForRef(compare.right)} />
          {snapshots.length > 0 && (
            <div>
              <SectionLabel>Snapshots</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {snapshots.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-2 rounded-full bg-glass px-3 py-1 text-[0.875rem] ring-1 ring-rule-soft">
                    📸 {d.name}
                    <button onClick={async () => { await deleteDoc('snapshot', d.id); refresh() }} className="text-ink-faint hover:text-rose" aria-label={`Delete snapshot ${d.name}`}><X size={12} weight="bold" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

function render(format: Format, entries: Entry[], label: string): string {
  if (entries.length === 0) return '# nothing captured for this selection yet'
  switch (format) {
    case 'yaml':
      return [`# rehydration manifest — ${label}`, 'services:', ...entries.map((e) => `  ${e.service}:\n    helmTag: "${e.helmTag}"${e.chart ? `\n    chart: ${e.chart}` : ''}${e.namespace ? `\n    namespace: ${e.namespace}` : ''}`)].join('\n')
    case 'json':
      return JSON.stringify({ label, services: Object.fromEntries(entries.map((e) => [e.service, { helmTag: e.helmTag, chart: e.chart ?? undefined, namespace: e.namespace ?? undefined }])) }, null, 2)
    case 'helm':
      return entries.map((e) => `helm upgrade --install ${e.service} ${e.chart ?? `<repo>/${e.service}`} --version ${e.helmTag}${e.namespace ? ` --namespace ${e.namespace}` : ''} --atomic --wait`).join('\n')
    case 'manifest':
      return entries.map((e) => `${e.service}=${e.helmTag}`).join('\n')
    case 'env':
      return entries.map((e) => `${e.service.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_HELM_TAG=${e.helmTag}`).join('\n')
    case 'csv':
      return ['service,helmTag,chart,namespace', ...entries.map((e) => [e.service, e.helmTag, e.chart ?? '', e.namespace ?? ''].map((x) => (/[,"]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(','))].join('\n')
  }
}

function DiffTable({ left, right }: { left: Entry[]; right: Entry[] }) {
  if (left.length === 0 && right.length === 0) return <div className="text-[0.875rem] text-ink-faint">Pick two environments or snapshots to compare.</div>
  const l = new Map(left.map((e) => [e.service, e.helmTag]))
  const r = new Map(right.map((e) => [e.service, e.helmTag]))
  const all = Array.from(new Set([...l.keys(), ...r.keys()])).sort()
  return (
    <div className="overflow-x-auto rounded-2xl border border-rule-soft">
      <table className="w-full text-left text-[0.875rem]">
        <tbody>
          {all.map((s) => {
            const a = l.get(s)
            const b = r.get(s)
            const kind = !a ? 'added' : !b ? 'removed' : a === b ? 'same' : 'changed'
            const tone = { added: 'emerald', removed: 'rose', changed: 'warm', same: 'muted' } as const
            return (
              <tr key={s} className="border-t border-rule-soft first:border-t-0">
                <td className="px-4 py-2 font-semibold text-ink">{s}</td>
                <td className="px-4 py-2 font-mono text-ink-soft">{a ?? '—'}</td>
                <td className="px-2 py-2 text-ink-faint">→</td>
                <td className="px-4 py-2 font-mono text-ink">{b ?? '—'}</td>
                <td className="px-4 py-2 text-right"><Badge tone={tone[kind]}>{kind}</Badge></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HistoryDrawer({ service, env, records, servers, onClose, onDelete }: { service: string; env: string; records: HelmRecord[]; servers: JenkinsServer[]; onClose: () => void; onDelete: (id: number) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <div className="font-display text-[1.6rem] text-ink">{service} · {env}</div>
            <Badge tone="violet">{records.length} capture{records.length === 1 ? '' : 's'}</Badge>
            <button onClick={onClose} className="ml-auto rounded-lg p-1 text-ink-faint hover:text-ink" aria-label="Close history"><X size={18} weight="bold" /></button>
          </div>
          {records.map((r, i) => {
            const server = servers.find((s) => s.name === r.serverName)
            return (
              <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${i === 0 ? 'bg-violet/[0.08] ring-violet/40' : 'bg-glass ring-rule-soft'}`}>
                <div className="min-w-0 flex-1">
                  <div className="break-all font-mono text-[1rem] font-semibold text-ink">{r.helmTag} {i === 0 && <Badge tone="violet">current</Badge>}</div>
                  <div className="text-[0.8125rem] text-ink-faint">
                    {new Date(r.capturedAt).toLocaleString()} {r.jobPath ? `· ${r.jobPath}` : ''} {r.buildNumber ? `#${r.buildNumber}` : ''} {r.namespace ? `· ns ${r.namespace}` : ''} {r.imageTag ? `· image ${r.imageTag}` : ''}
                  </div>
                </div>
                {server && r.jobPath && (
                  <Button variant="ghost" onClick={() => { requestOpenBuild({ serverId: server.id, jobPath: r.jobPath!, number: r.buildNumber ?? null }); window.dispatchEvent(new CustomEvent('devtools:open-tool', { detail: 'jenkins' })) }}>
                    <Rocket size={15} /> Open build
                  </Button>
                )}
                {r.buildUrl && <a href={r.buildUrl} target="_blank" rel="noreferrer" className="rounded-full p-2 text-ink-faint hover:bg-glass hover:text-ink" title="Open in Jenkins"><ArrowSquareOut size={16} /></a>}
                <button onClick={() => onDelete(r.id)} className="rounded-full p-2 text-ink-faint hover:text-rose" aria-label="Delete record"><Trash size={16} /></button>
              </div>
            )
          })}
        </div>
      </Panel>
    </motion.div>
  )
}

const REHYDRATE_KEY = 'devtools.rehydrate.config'
type RehydrateCfg = { serverId: number | null; jobPath: string; mode: 'single' | 'per-service'; params: string }
function loadRehydrate(): RehydrateCfg {
  try {
    const raw = localStorage.getItem(REHYDRATE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { serverId: null, jobPath: 'platform/rehydrate-environment', mode: 'single', params: 'ENV=${env}\nMANIFEST=${manifest}' }
}

function RehydratePanel({ servers, entries, label, environment }: { servers: JenkinsServer[]; entries: Entry[]; label: string; environment: string }) {
  const [cfg, setCfg] = useState<RehydrateCfg>(loadRehydrate)
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ text: string; ok: boolean; serverId?: number; number?: number; path?: string }[]>([])
  useEffect(() => {
    try {
      localStorage.setItem(REHYDRATE_KEY, JSON.stringify(cfg))
    } catch {
      /* ignore */
    }
  }, [cfg])
  const serverId = cfg.serverId ?? servers[0]?.id ?? null

  function params(ctx: Record<string, string>) {
    const o: Record<string, string> = {}
    // a value may legitimately span lines (MANIFEST): substitute first, then split KEY=value lines
    for (const line of cfg.params.split('\n')) {
      const eq = line.indexOf('=')
      if (eq > 0) o[line.slice(0, eq).trim()] = template(line.slice(eq + 1).trim(), ctx)
    }
    return o
  }

  async function go() {
    if (!serverId) return
    setBusy(true)
    setOut([])
    const manifest = entries.map((e) => `${e.service}=${e.helmTag}`).join('\n')
    const runs = cfg.mode === 'single' ? [{ env: environment, manifest, service: '', helmTag: '' }] : entries.map((e) => ({ env: environment, manifest, service: e.service, helmTag: e.helmTag }))
    for (const r of runs) {
      try {
        const p = params({ env: r.env, manifest: r.manifest, service: r.service, helmTag: r.helmTag })
        const q = await triggerBuild(serverId, cfg.jobPath, p, true)
        let n: number | null = null
        for (let i = 0; i < 60 && q.queueId && !n; i++) {
          n = (await getQueueItem(serverId, q.queueId)).buildNumber
          if (!n) await new Promise((res) => setTimeout(res, 1000))
        }
        setOut((o) => [...o, { text: `${r.service || 'all services'} → ${cfg.jobPath} ${n ? `#${n}` : '(queued)'}`, ok: true, serverId, number: n ?? undefined, path: cfg.jobPath }])
      } catch (e) {
        setOut((o) => [...o, { text: `${r.service || 'all services'}: ${e instanceof Error ? e.message : 'failed'}`, ok: false }])
      }
    }
    setBusy(false)
    celebrate()
  }

  return (
    <Panel>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Lightning size={22} weight="fill" className="text-warm" />
          <div className="font-display text-[1.6rem] text-ink">Rehydrate {label || 'environment'}</div>
        </div>
        <p className="text-[0.875rem] leading-relaxed text-ink-faint">
          Triggers your rehydration job with these pinned tags. Placeholders: <code className="font-mono">${'{'}env{'}'}</code>, <code className="font-mono">${'{'}manifest{'}'}</code> (svc=tag lines), and per-service mode adds <code className="font-mono">${'{'}service{'}'}</code>, <code className="font-mono">${'{'}helmTag{'}'}</code>.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Jenkins">
            <Select value={serverId ?? ''} onChange={(e) => setCfg({ ...cfg, serverId: Number(e.target.value) })}>
              {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Job path"><Input value={cfg.jobPath} onChange={(e) => setCfg({ ...cfg, jobPath: e.target.value })} /></Field>
        </div>
        <Segmented id="rehydrate-mode" size="sm" value={cfg.mode} onChange={(m) => setCfg({ ...cfg, mode: m, params: m === 'single' ? 'ENV=${env}\nMANIFEST=${manifest}' : 'ENV=${env}\nSERVICE=${service}\nHELM_TAG=${helmTag}' })} options={[{ id: 'single', label: 'One build, whole manifest' }, { id: 'per-service', label: 'One build per service' }]} />
        <Field label="Parameters"><textarea rows={3} className="devtools-input font-mono" value={cfg.params} onChange={(e) => setCfg({ ...cfg, params: e.target.value })} /></Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={go} disabled={busy || !serverId || entries.length === 0}>
            {busy ? <CircleNotch size={16} className="animate-spin" /> : <Rocket size={16} weight="fill" />} Rehydrate {entries.length} service{entries.length === 1 ? '' : 's'}
          </Button>
          {servers.length === 0 && <span className="text-[0.875rem] text-ink-faint">Add a Jenkins server in Pipeline Studio first.</span>}
        </div>
        {out.map((o, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[0.875rem] ${o.ok ? 'bg-emerald/10 text-emerald' : 'bg-rose/10 text-rose'}`}>
            <span className="flex-1">{o.text}</span>
            {o.ok && o.number && o.serverId && (
              <Button variant="ghost" onClick={() => { requestOpenBuild({ serverId: o.serverId!, jobPath: o.path!, number: o.number! }); window.dispatchEvent(new CustomEvent('devtools:open-tool', { detail: 'jenkins' })) }}>
                Watch
              </Button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}
