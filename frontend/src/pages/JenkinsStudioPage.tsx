import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowsClockwise,
  CaretRight,
  CheckCircle,
  CircleNotch,
  Copy,
  Flask,
  Folder,
  FlowArrow,
  Gear,
  HandPalm,
  LinkSimple,
  Lightning,
  MagnifyingGlass,
  Play,
  Plus,
  Plugs,
  PlugsConnected,
  Rocket,
  Stop,
  Tag,
  Trash,
  XCircle,
} from '@phosphor-icons/react'
import type { Tool } from '../App'
import {
  colorTone,
  createDemoServer,
  createDoc,
  createRecord,
  createServer,
  defaultHelmPatterns,
  defaultValue,
  deleteDoc,
  deleteServer,
  extractHelmTag,
  extractHelmTagFromText,
  fmtAgo,

  getBuild,
  getJob,
  getLog,
  getQueueItem,
  isFolder,
  listDocs,
  listJobs,
  listServers,
  loadCustomPatterns,
  paramDefs,
  parseBuildUrl,
  resultTone,
  saveCustomPatterns,
  submitInput,
  takePendingOpen,
  template,
  testServer,
  triggerBuild,
  updateDoc,
  updateServer,
  type BuildInfo,
  type HelmResult,
  type JenkinsServer,
  type JobDetail,
  type JobList,
  type JsonDoc,
  type PatternDef,
} from '../lib/jenkinsApi'
import { Badge, Button, EmptyState, ErrorBanner, Field, Input, Panel, Segmented, Select, SectionLabel, StatTile, TextArea, Toggle } from '../components/ui'
import { BuildMonitor, HelmResultView, InputCard, ParamForm, StatusDot } from '../components/JenkinsParts'
import { celebrate } from '../components/CursorFx'

type View = 'jobs' | 'flows' | 'helm' | 'servers'
const SERVER_KEY = 'devtools.jenkins.server'

export function JenkinsStudioPage({ onOpenTool }: { onOpenTool?: (id: Tool) => void }) {
  const [servers, setServers] = useState<JenkinsServer[]>([])
  const [serverId, setServerId] = useState<number | null>(() => {
    const v = Number(localStorage.getItem(SERVER_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  })
  const [view, setView] = useState<View>('jobs')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [conn, setConn] = useState<{ ok: boolean; text: string } | null>(null)
  const [openRef, setOpenRef] = useState<{ jobPath: string; number: number | null; nonce: number } | null>(null)

  const refreshServers = useCallback(async () => {
    try {
      const s = await listServers()
      setServers(s)
      setServerId((cur) => (cur && s.some((x) => x.id === cur) ? cur : s[0]?.id ?? null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load servers')
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refreshServers()
  }, [refreshServers])

  useEffect(() => {
    if (serverId) localStorage.setItem(SERVER_KEY, String(serverId))
    setConn(null)
    if (!serverId) return
    testServer(serverId)
      .then((r) => setConn({ ok: true, text: `Jenkins ${r.version} · ${r.user}` }))
      .catch((e) => setConn({ ok: false, text: e instanceof Error ? e.message : 'unreachable' }))
  }, [serverId])

  // Hand-off from Rehydration Board ("open this build in Pipeline Studio")
  useEffect(() => {
    function take() {
      const p = takePendingOpen()
      if (!p) return
      setServerId(p.serverId)
      setView('jobs')
      setOpenRef({ jobPath: p.jobPath, number: p.number, nonce: Date.now() })
    }
    take()
    window.addEventListener('devtools:jenkins-open', take)
    return () => window.removeEventListener('devtools:jenkins-open', take)
  }, [])

  const server = servers.find((s) => s.id === serverId) ?? null

  async function addDemo() {
    try {
      const s = await createDemoServer()
      await refreshServers()
      setServerId(s.id)
      setView('jobs')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the demo server')
    }
  }

  if (loaded && servers.length === 0 && view !== 'servers') {
    return (
      <div className="flex h-full items-center justify-center overflow-auto">
        <Panel className="w-full max-w-2xl">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <motion.div initial={{ scale: 0.5, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
              <Rocket size={64} weight="duotone" className="text-cyan" />
            </motion.div>
            <div className="font-display gradient-text text-[2.6rem] leading-none">Connect your Jenkins</div>
            <p className="max-w-lg text-[1rem] leading-relaxed text-ink-soft">
              Trigger CI, watch stages live, hit <b className="text-warm">Proceed</b> on the CD approval gate, and grab the Helm tag for rehydration —
              without clicking through five Jenkins pages. Your API token stays on this machine.
            </p>
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setView('servers')}><Plugs size={16} weight="bold" /> Add my Jenkins</Button>
              <Button onClick={addDemo}><Flask size={16} weight="bold" /> Try the built-in demo Jenkins</Button>
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Segmented
          id="jenkins-view"
          value={view}
          onChange={setView}
          options={[
            { id: 'jobs', label: <span className="inline-flex items-center gap-1.5"><Rocket size={15} weight="bold" /> Jobs & builds</span> },
            { id: 'flows', label: <span className="inline-flex items-center gap-1.5"><FlowArrow size={15} weight="bold" /> Release flows</span> },
            { id: 'helm', label: <span className="inline-flex items-center gap-1.5"><Tag size={15} weight="bold" /> Helm tag finder</span> },
            { id: 'servers', label: <span className="inline-flex items-center gap-1.5"><Gear size={15} weight="bold" /> Servers</span> },
          ]}
        />
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
          {servers.length > 0 && (
            <Select value={serverId ?? ''} onChange={(e) => setServerId(Number(e.target.value))} className="!w-auto max-w-[18rem]">
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          )}
          {conn && (
            <Badge tone={conn.ok ? 'emerald' : 'rose'} className="max-w-[22rem]">
              {conn.ok ? <PlugsConnected size={13} weight="bold" /> : <Plugs size={13} weight="bold" />}
              <span className="truncate" title={conn.text}>{conn.text}</span>
            </Badge>
          )}
          {onOpenTool && (
            <Button variant="ghost" onClick={() => onOpenTool('rehydration')}>
              <ArrowsClockwise size={15} weight="bold" /> Rehydration Board
            </Button>
          )}
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="min-h-0 flex-1">
        {view === 'jobs' && server && <JobsView key={server.id} server={server} servers={servers} openRef={openRef} />}
        {view === 'flows' && <FlowsView servers={servers} defaultServerId={serverId} />}
        {view === 'helm' && <HelmFinderView server={server} servers={servers} />}
        {view === 'servers' && <ServersView servers={servers} onChange={refreshServers} onAddDemo={addDemo} onSelect={(id) => { setServerId(id); setView('jobs') }} />}
      </div>
    </div>
  )
}

// =====================================================================================
// Jobs & builds
// =====================================================================================

function JobsView({ server, servers, openRef }: { server: JenkinsServer; servers: JenkinsServer[]; openRef: { jobPath: string; number: number | null; nonce: number } | null }) {
  const [folder, setFolder] = useState('')
  const [list, setList] = useState<JobList | null>(null)
  const [filter, setFilter] = useState('')
  const [jobPath, setJobPath] = useState<string | null>(null)
  const [job, setJob] = useState<JobDetail | null>(null)
  const [params, setParams] = useState<Record<string, string>>({})
  const [buildNo, setBuildNo] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')

  const loadFolder = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      setList(await listJobs(server.id, path))
      setFolder(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not list jobs')
    } finally {
      setLoading(false)
    }
  }, [server.id])

  useEffect(() => {
    loadFolder('')
  }, [loadFolder])

  const loadJob = useCallback(async (path: string) => {
    setError(null)
    try {
      const j = await getJob(server.id, path)
      if (isFolder(j)) {
        loadFolder(path)
        return
      }
      setJob(j)
      setJobPath(path)
      setParams(Object.fromEntries(paramDefs(j).map((p) => [p.name, defaultValue(p)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load job')
    }
  }, [server.id, loadFolder])

  useEffect(() => {
    if (!openRef) return
    const parent = openRef.jobPath.split('/').slice(0, -1).join('/')
    loadFolder(parent)
    loadJob(openRef.jobPath)
    setBuildNo(openRef.number)
  }, [openRef, loadFolder, loadJob])

  // refresh job's build list while something is running
  useEffect(() => {
    if (!jobPath) return
    const id = setInterval(() => {
      getJob(server.id, jobPath).then(setJob).catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [server.id, jobPath])

  async function trigger(overrides?: Record<string, string>) {
    if (!jobPath || !job) return
    setError(null)
    setTriggering('Queueing…')
    try {
      const defs = paramDefs(job)
      const q = await triggerBuild(server.id, jobPath, overrides ?? params, defs.length > 0)
      if (!q.queueId) {
        setTriggering(null)
        setError('Build was queued, but Jenkins returned no queue item to follow. Refresh the build list in a moment.')
        return
      }
      for (let i = 0; i < 240; i++) {
        const item = await getQueueItem(server.id, q.queueId)
        if (item.cancelled) throw new Error('The queued build was cancelled.')
        if (item.buildNumber) {
          setBuildNo(item.buildNumber)
          getJob(server.id, jobPath).then(setJob).catch(() => {})
          break
        }
        setTriggering(item.why ?? 'Waiting in queue…')
        await new Promise((r) => setTimeout(r, 1000))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trigger failed')
    } finally {
      setTriggering(null)
    }
  }

  function openUrl() {
    const ref = parseBuildUrl(urlInput, servers.filter((s) => s.id === server.id).concat(servers.filter((s) => s.id !== server.id)))
    if (!ref) {
      setError("That doesn't look like a Jenkins job/build URL (expected …/job/<name>/…/<number>/).")
      return
    }
    loadFolder(ref.jobPath.split('/').slice(0, -1).join('/'))
    loadJob(ref.jobPath)
    setBuildNo(ref.number)
    setUrlInput('')
  }

  const crumbs = folder ? folder.split('/') : []
  const jobs = (list?.jobs ?? []).filter((j) => !filter || j.name.toLowerCase().includes(filter.toLowerCase()))
  const defs = paramDefs(job)

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-lg:[&>*]:shrink-0 lg:flex-row lg:overflow-hidden">
      <Panel className="lg:w-[min(23rem,38%)] lg:shrink-0">
        <div className="flex h-full min-h-0 flex-col gap-3 p-4">
          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <LinkSimple size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && openUrl()} placeholder="Paste a job / build URL" className="pl-8" />
            </div>
            <Button onClick={openUrl} disabled={!urlInput.trim()}>Open</Button>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[0.875rem]">
            <button onClick={() => loadFolder('')} className="rounded-lg px-1.5 py-0.5 font-semibold text-cyan hover:bg-glass">{server.name}</button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <CaretRight size={11} className="text-ink-faint" />
                <button onClick={() => loadFolder(crumbs.slice(0, i + 1).join('/'))} className="rounded-lg px-1.5 py-0.5 text-ink-soft hover:bg-glass hover:text-ink">{c}</button>
              </span>
            ))}
            <button onClick={() => loadFolder(folder)} className="ml-auto rounded-lg p-1 text-ink-faint hover:text-ink" title="Refresh">
              <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="relative">
            <MagnifyingGlass size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter jobs" className="pl-8" />
          </div>
          <div className="-mx-1 flex min-h-[12rem] flex-1 flex-col gap-1 overflow-y-auto px-1">
            {folder && (
              <button onClick={() => loadFolder(crumbs.slice(0, -1).join('/'))} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.9375rem] text-ink-faint hover:bg-glass">
                <ArrowLeft size={15} /> ..
              </button>
            )}
            {jobs.map((j, i) => {
              const path = folder ? `${folder}/${j.name}` : j.name
              const folderish = isFolder(j)
              const { tone, building } = colorTone(j.color)
              const active = path === jobPath
              return (
                <motion.button
                  key={j.url}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.025, 0.4) }}
                  onClick={() => (folderish ? loadFolder(path) : (loadJob(path), setBuildNo(null)))}
                  className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'nav-active-pill relative' : 'hover:bg-glass'}`}
                >
                  {folderish ? <Folder size={18} weight="duotone" className="shrink-0 text-warm" /> : <StatusDot tone={tone} building={building} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.9375rem] font-semibold text-ink">{j.name}</div>
                    {j.lastBuild ? (
                      <div className="truncate text-[0.8125rem] text-ink-faint">
                        #{j.lastBuild.number} · {j.lastBuild.building ? 'running' : (j.lastBuild.result ?? '').toLowerCase()} · {fmtAgo(j.lastBuild.timestamp)}
                      </div>
                    ) : (
                      j.description && <div className="truncate text-[0.8125rem] text-ink-faint">{j.description}</div>
                    )}
                  </div>
                  {folderish && <CaretRight size={14} className="shrink-0 text-ink-faint" />}
                </motion.button>
              )
            })}
            {!loading && jobs.length === 0 && <div className="px-3 py-6 text-center text-[0.875rem] text-ink-faint">No jobs here.</div>}
          </div>
        </div>
      </Panel>

      <Panel className="min-w-0 flex-1">
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 [&>*]:shrink-0">
          {error && <ErrorBanner message={error} />}
          {!job && <EmptyState icon={<Rocket size={44} weight="duotone" />} title="Pick a job on the left">Or paste any Jenkins build URL to jump straight to its live console, stages and approval gate.</EmptyState>}
          {job && jobPath && (
            <>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-ink-faint">{jobPath.split('/').slice(0, -1).join(' / ') || 'root'}</div>
                  <div className="font-display break-all text-[2.2rem] leading-none text-ink">{job.name}</div>
                  {job.description && <div className="mt-1 text-[0.9375rem] text-ink-soft">{job.description}</div>}
                </div>
                <Button variant="primary" onClick={() => trigger()} disabled={!!triggering} className="!px-6 !py-2.5 !text-[1rem]">
                  {triggering ? <CircleNotch size={17} className="animate-spin" /> : <Play size={17} weight="fill" />} {triggering ? 'Queued' : defs.length ? 'Build with parameters' : 'Build now'}
                </Button>
              </div>
              {triggering && <div className="text-[0.875rem] text-cyan">{triggering}</div>}
              {defs.length > 0 && (
                <details open={!buildNo} className="rounded-2xl border border-rule-soft p-4">
                  <summary className="cursor-pointer text-[0.875rem] font-bold uppercase tracking-[0.12em] text-ink-soft">Parameters ({defs.length})</summary>
                  <div className="mt-3"><ParamForm defs={defs} values={params} onChange={setParams} /></div>
                </details>
              )}
              <div>
                <SectionLabel>Recent builds</SectionLabel>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(job.builds ?? []).slice(0, 25).map((b) => {
                    const tone = resultTone(b.result, b.building)
                    const active = b.number === buildNo
                    const ring = { emerald: 'ring-emerald/40', rose: 'ring-rose/50', warm: 'ring-warm/50', cyan: 'ring-cyan/60', muted: 'ring-rule', violet: 'ring-violet/40' }[tone]
                    return (
                      <button
                        key={b.number}
                        onClick={() => setBuildNo(b.number)}
                        className={`flex shrink-0 flex-col items-start rounded-xl px-3 py-1.5 text-left ring-1 transition-transform hover:-translate-y-0.5 ${ring} ${active ? 'bg-glass-strong' : 'bg-glass'}`}
                      >
                        <span className="flex items-center gap-1.5 font-mono text-[0.9375rem] font-semibold text-ink">
                          <StatusDot tone={tone} building={b.building} /> #{b.number}
                        </span>
                        <span className="text-[0.75rem] text-ink-faint">{fmtAgo(b.timestamp)}{b.description ? ` · ${b.description}` : ''}</span>
                      </button>
                    )
                  })}
                  {(job.builds ?? []).length === 0 && <span className="text-[0.875rem] text-ink-faint">No builds yet.</span>}
                </div>
              </div>
              {buildNo && (
                <div className="rounded-3xl border border-rule-soft p-4">
                  <BuildMonitor
                    key={`${jobPath}#${buildNo}`}
                    serverId={server.id}
                    serverName={server.name}
                    jobPath={jobPath}
                    number={buildNo}
                    onRebuild={(p) => trigger(p)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}

// =====================================================================================
// Release flows: CI → CD → Proceed → Helm tag → Rehydration Board, as one button
// =====================================================================================

type Capture = { name: string; regex: string }
type FlowConfig = {
  serverId: number | null
  service: string
  environment: string
  ci: { enabled: boolean; jobPath: string; params: string; captures: Capture[]; existingBuild: string }
  cd: { jobPath: string; params: string }
  proceed: 'manual' | 'auto'
  proceedParams: string
  saveToBoard: boolean
}

const EMPTY_FLOW: FlowConfig = {
  serverId: null,
  service: 'order-service',
  environment: 'UAT',
  ci: {
    enabled: true,
    jobPath: 'platform/order-service-ci',
    params: 'BRANCH=main',
    captures: [{ name: 'VERSION', regex: '^VERSION=(\\S+)' }],
    existingBuild: '',
  },
  cd: { jobPath: 'platform/order-service-cd', params: 'VERSION=${ci.VERSION}\nENV=${env}' },
  proceed: 'manual',
  proceedParams: '',
  saveToBoard: true,
}

function parseKv(text: string, ctx: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    out[t.slice(0, eq).trim()] = template(t.slice(eq + 1).trim(), ctx)
  }
  return out
}

type StepId = 'ci' | 'capture' | 'cd' | 'approve' | 'helm' | 'save'
type StepState = 'idle' | 'running' | 'waiting' | 'done' | 'failed' | 'skipped'
type RunState = {
  steps: Record<StepId, StepState>
  log: { at: number; text: string; tone?: 'ok' | 'bad' | 'warn' }[]
  ciBuild: number | null
  cdBuild: number | null
  ctx: Record<string, string>
  cdInfo: BuildInfo | null
  helm: HelmResult | null
  status: 'idle' | 'running' | 'done' | 'failed' | 'cancelled'
}

const STEP_LABELS: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: 'ci', label: 'CI build', icon: Rocket },
  { id: 'capture', label: 'Capture outputs', icon: MagnifyingGlass },
  { id: 'cd', label: 'CD build', icon: Lightning },
  { id: 'approve', label: 'Proceed gate', icon: HandPalm },
  { id: 'helm', label: 'Helm tag', icon: Tag },
  { id: 'save', label: 'Rehydration Board', icon: CheckCircle },
]

function freshRun(): RunState {
  return {
    steps: { ci: 'idle', capture: 'idle', cd: 'idle', approve: 'idle', helm: 'idle', save: 'idle' },
    log: [],
    ciBuild: null,
    cdBuild: null,
    ctx: {},
    cdInfo: null,
    helm: null,
    status: 'idle',
  }
}

function FlowsView({ servers, defaultServerId }: { servers: JenkinsServer[]; defaultServerId: number | null }) {
  const [docs, setDocs] = useState<JsonDoc[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [name, setName] = useState('Order service → UAT')
  const [cfg, setCfg] = useState<FlowConfig>({ ...EMPTY_FLOW, serverId: defaultServerId })
  const [run, setRun] = useState<RunState>(freshRun)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const approvalRef = useRef<((v: { action: 'proceed' | 'abort'; params: Record<string, string> }) => void) | null>(null)
  const [pendingApproval, setPendingApproval] = useState<BuildInfo['pendingInputs'][number] | null>(null)
  const runPanelRef = useRef<HTMLDivElement>(null)
  const runStatus = run.status

  // bring the live run (and later the approval card) into view — it renders below the editor
  useEffect(() => {
    if (runStatus === 'running') runPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [runStatus])
  useEffect(() => {
    if (pendingApproval) runPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [pendingApproval])

  const refresh = useCallback(async () => {
    try {
      setDocs(await listDocs('flow'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load flows')
    }
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  function load(d: JsonDoc) {
    setSelected(d.id)
    setName(d.name)
    try {
      setCfg({ ...EMPTY_FLOW, ...JSON.parse(d.body) })
    } catch {
      setError('That flow is corrupt.')
    }
    setRun(freshRun())
  }

  async function save() {
    try {
      const d = selected ? await updateDoc('flow', selected, name, cfg) : await createDoc('flow', name, cfg)
      setSelected(d.id)
      setSavedNote('Saved')
      setTimeout(() => setSavedNote(null), 1500)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function remove() {
    if (!selected) return
    await deleteDoc('flow', selected)
    setSelected(null)
    refresh()
  }

  const serverId = cfg.serverId ?? defaultServerId
  const server = servers.find((s) => s.id === serverId) ?? null

  function upd(fn: (r: RunState) => RunState) {
    setRun((r) => fn(r))
  }
  function logLine(text: string, tone?: 'ok' | 'bad' | 'warn') {
    upd((r) => ({ ...r, log: [...r.log, { at: Date.now(), text, tone }] }))
  }
  function step(id: StepId, s: StepState) {
    upd((r) => ({ ...r, steps: { ...r.steps, [id]: s } }))
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  async function waitQueue(sid: number, queueId: number | null): Promise<number> {
    if (!queueId) throw new Error('Jenkins gave no queue item to follow')
    for (let i = 0; i < 600; i++) {
      if (cancelRef.current) throw new Error('cancelled')
      const q = await getQueueItem(sid, queueId)
      if (q.cancelled) throw new Error('Queue item was cancelled in Jenkins')
      if (q.buildNumber) return q.buildNumber
      await sleep(1000)
    }
    throw new Error('Timed out waiting in the queue')
  }

  async function waitBuild(sid: number, path: string, n: number, onPaused?: (b: BuildInfo) => Promise<void>): Promise<BuildInfo> {
    for (;;) {
      if (cancelRef.current) throw new Error('cancelled')
      const b = await getBuild(sid, path, n)
      if (path === cfg.cd.jobPath) upd((r) => ({ ...r, cdInfo: b }))
      if (!b.building) return b
      if (b.pendingInputs.length > 0 && onPaused) await onPaused(b)
      await sleep(1500)
    }
  }

  async function start() {
    if (!serverId) {
      setError('Pick a Jenkins server for this flow.')
      return
    }
    cancelRef.current = false
    setError(null)
    const sid = serverId
    const ctx: Record<string, string> = { env: cfg.environment, service: cfg.service }
    setRun({ ...freshRun(), status: 'running' })
    try {
      // ---- CI
      if (cfg.ci.enabled) {
        step('ci', 'running')
        let ciNo: number
        if (cfg.ci.existingBuild.trim()) {
          ciNo = Number(cfg.ci.existingBuild.trim())
          logLine(`Using existing CI build ${cfg.ci.jobPath} #${ciNo}`)
        } else {
          const p = parseKv(cfg.ci.params, ctx)
          logLine(`Triggering ${cfg.ci.jobPath} ${Object.keys(p).length ? JSON.stringify(p) : ''}`)
          const q = await triggerBuild(sid, cfg.ci.jobPath, p, true)
          ciNo = await waitQueue(sid, q.queueId)
          logLine(`CI started as #${ciNo}`)
        }
        upd((r) => ({ ...r, ciBuild: ciNo }))
        const ci = await waitBuild(sid, cfg.ci.jobPath, ciNo)
        if (ci.result !== 'SUCCESS') {
          step('ci', 'failed')
          throw new Error(`CI build #${ciNo} finished ${ci.result} — stopping the flow`)
        }
        step('ci', 'done')
        logLine(`CI #${ciNo} is green`, 'ok')
        ctx['ci.buildNumber'] = String(ciNo)
        // ---- captures
        step('capture', 'running')
        let text = ''
        let start = 0
        for (let i = 0; i < 50; i++) {
          const chunk = await getLog(sid, cfg.ci.jobPath, ciNo, start)
          text += chunk.text
          start = chunk.nextStart
          if (!chunk.more || !chunk.text) break
        }
        for (const c of cfg.ci.captures) {
          if (!c.name || !c.regex) continue
          try {
            const re = new RegExp(c.regex, 'm')
            const all = [...text.matchAll(new RegExp(c.regex, 'gm'))]
            const m = all.length ? all[all.length - 1] : re.exec(text)
            if (m) {
              ctx[`ci.${c.name}`] = m[1] ?? m[0]
              logLine(`Captured ci.${c.name} = ${ctx[`ci.${c.name}`]}`, 'ok')
            } else logLine(`Capture ${c.name} matched nothing in the CI log`, 'warn')
          } catch {
            logLine(`Capture ${c.name} has an invalid regex`, 'bad')
          }
        }
        for (const p of ci.parameters) ctx[`ci.param.${p.name}`] = p.value
        step('capture', 'done')
      } else {
        step('ci', 'skipped')
        step('capture', 'skipped')
      }
      upd((r) => ({ ...r, ctx: { ...ctx } }))

      // ---- CD
      step('cd', 'running')
      const cdParams = parseKv(cfg.cd.params, ctx)
      const unresolved = Object.entries(cdParams).filter(([, v]) => /\$\{/.test(v))
      if (unresolved.length) logLine(`Unresolved placeholders: ${unresolved.map(([k, v]) => `${k}=${v}`).join(', ')}`, 'warn')
      logLine(`Triggering ${cfg.cd.jobPath} ${JSON.stringify(cdParams)}`)
      const q = await triggerBuild(sid, cfg.cd.jobPath, cdParams, true)
      const cdNo = await waitQueue(sid, q.queueId)
      upd((r) => ({ ...r, cdBuild: cdNo }))
      logLine(`CD started as #${cdNo}`)
      const handled = new Set<string>()
      const cd = await waitBuild(sid, cfg.cd.jobPath, cdNo, async (b) => {
        const input = b.pendingInputs.find((x) => !handled.has(x.id))
        if (!input) return
        handled.add(input.id)
        step('cd', 'done')
        step('approve', 'waiting')
        if (cfg.proceed === 'auto') {
          logLine(`Auto-proceeding “${input.message}”`, 'warn')
          await submitInput(sid, cfg.cd.jobPath, cdNo, input.id, 'proceed', parseKv(cfg.proceedParams, ctx))
          step('approve', 'done')
          step('cd', 'running')
          return
        }
        logLine(`Waiting for you: “${input.message}”`, 'warn')
        setPendingApproval(input)
        const decision = await new Promise<{ action: 'proceed' | 'abort'; params: Record<string, string> }>((resolve) => {
          approvalRef.current = resolve
        })
        setPendingApproval(null)
        if (cancelRef.current) throw new Error('cancelled')
        await submitInput(sid, cfg.cd.jobPath, cdNo, input.id, decision.action, decision.params)
        logLine(decision.action === 'proceed' ? 'Proceeded ✓' : 'Aborted ✗', decision.action === 'proceed' ? 'ok' : 'bad')
        step('approve', decision.action === 'proceed' ? 'done' : 'failed')
        step('cd', 'running')
      })
      upd((r) => ({ ...r, cdInfo: cd }))
      upd((r) => (r.steps.approve === 'idle' ? { ...r, steps: { ...r.steps, approve: 'skipped' } } : r))
      if (cd.result !== 'SUCCESS') {
        step('cd', 'failed')
        throw new Error(`CD build #${cdNo} finished ${cd.result}`)
      }
      step('cd', 'done')
      logLine(`CD #${cdNo} deployed`, 'ok')

      // ---- helm tag
      step('helm', 'running')
      const helm = await extractHelmTag(sid, cfg.cd.jobPath, cdNo, loadCustomPatterns() ?? undefined)
      upd((r) => ({ ...r, helm }))
      if (!helm.best) {
        step('helm', 'failed')
        throw new Error('CD succeeded but no helm tag was found in its console — add a pattern in Helm tag finder')
      }
      step('helm', 'done')
      logLine(`Helm tag: ${helm.best}`, 'ok')

      // ---- save
      if (cfg.saveToBoard) {
        step('save', 'running')
        const rel = helm.releases[helm.releases.length - 1]
        await createRecord({
          service: cfg.service || rel?.release || cfg.cd.jobPath,
          environment: cfg.environment,
          helmTag: helm.best,
          chart: rel?.chart ?? null,
          chartVersion: rel?.version ?? null,
          imageTag: rel?.imageTag ?? null,
          namespace: rel?.namespace ?? null,
          serverName: server?.name ?? null,
          jobPath: cfg.cd.jobPath,
          buildNumber: cdNo,
          buildUrl: cd.url,
        })
        step('save', 'done')
        logLine(`Saved ${cfg.service} ${cfg.environment} → ${helm.best} on the Rehydration Board`, 'ok')
      } else step('save', 'skipped')
      upd((r) => ({ ...r, status: 'done' }))
      celebrate()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'cancelled') {
        logLine('Flow cancelled (builds already started keep running in Jenkins)', 'warn')
        upd((r) => ({ ...r, status: 'cancelled' }))
      } else {
        logLine(msg, 'bad')
        upd((r) => ({ ...r, status: 'failed' }))
      }
    }
  }

  function cancel() {
    cancelRef.current = true
    approvalRef.current?.({ action: 'abort', params: {} })
    setPendingApproval(null)
  }

  const running = run.status === 'running'
  const captures = cfg.ci.captures

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-xl:[&>*]:shrink-0 xl:flex-row xl:overflow-hidden">
      <Panel className="xl:w-[min(19rem,26%)] xl:shrink-0">
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Saved flows</SectionLabel>
            <Button variant="ghost" onClick={() => { setSelected(null); setName('New flow'); setCfg({ ...EMPTY_FLOW, serverId: defaultServerId }); setRun(freshRun()) }}>
              <Plus size={14} weight="bold" /> New
            </Button>
          </div>
          {docs.length === 0 && <div className="text-[0.875rem] text-ink-faint">No saved flows yet. The editor is pre-filled with a demo flow — save it to keep it.</div>}
          {docs.map((d) => (
            <button key={d.id} onClick={() => load(d)} className={`rounded-xl px-3 py-2 text-left transition-colors ${selected === d.id ? 'nav-active-pill relative' : 'hover:bg-glass'}`}>
              <div className="truncate text-[0.9375rem] font-semibold text-ink">{d.name}</div>
              <div className="text-[0.8125rem] text-ink-faint">edited {fmtAgo(d.updatedAt)}</div>
            </button>
          ))}
        </div>
      </Panel>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
        <Panel>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Flow name" className="min-w-[14rem] flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Jenkins" className="w-56">
                <Select value={serverId ?? ''} onChange={(e) => setCfg({ ...cfg, serverId: Number(e.target.value) })}>
                  {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Service" className="w-44"><Input value={cfg.service} onChange={(e) => setCfg({ ...cfg, service: e.target.value })} /></Field>
              <Field label="Environment" className="w-32"><Input value={cfg.environment} onChange={(e) => setCfg({ ...cfg, environment: e.target.value.toUpperCase() })} /></Field>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-rule-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[1.5rem] text-cyan">1 · CI</span>
                  <Toggle checked={cfg.ci.enabled} onChange={(v) => setCfg({ ...cfg, ci: { ...cfg.ci, enabled: v } })} label="Run CI" />
                </div>
                <Field label="CI job path"><Input value={cfg.ci.jobPath} disabled={!cfg.ci.enabled} onChange={(e) => setCfg({ ...cfg, ci: { ...cfg.ci, jobPath: e.target.value } })} placeholder="folder/my-service-ci" /></Field>
                <Field label="Parameters (KEY=value per line)"><textarea rows={3} className="devtools-input font-mono" disabled={!cfg.ci.enabled} value={cfg.ci.params} onChange={(e) => setCfg({ ...cfg, ci: { ...cfg.ci, params: e.target.value } })} /></Field>
                <Field label="…or reuse existing CI build #" hint="Leave blank to trigger a fresh build."><Input value={cfg.ci.existingBuild} disabled={!cfg.ci.enabled} onChange={(e) => setCfg({ ...cfg, ci: { ...cfg.ci, existingBuild: e.target.value.replace(/\D/g, '') } })} placeholder="e.g. 57" /></Field>
                <div>
                  <div className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-ink-soft">Capture from CI log → ${'{'}ci.NAME{'}'}</div>
                  {captures.map((c, i) => (
                    <div key={i} className="mb-1.5 flex gap-1.5">
                      <Input value={c.name} onChange={(e) => setCfg({ ...cfg, ci: { ...cfg.ci, captures: captures.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) } })} placeholder="NAME" className="!w-28" />
                      <Input value={c.regex} onChange={(e) => setCfg({ ...cfg, ci: { ...cfg.ci, captures: captures.map((x, j) => (j === i ? { ...x, regex: e.target.value } : x)) } })} placeholder="regex with (group)" className="font-mono" />
                      <button onClick={() => setCfg({ ...cfg, ci: { ...cfg.ci, captures: captures.filter((_, j) => j !== i) } })} className="px-1 text-ink-faint hover:text-rose" aria-label="Remove capture"><Trash size={15} /></button>
                    </div>
                  ))}
                  <Button variant="ghost" onClick={() => setCfg({ ...cfg, ci: { ...cfg.ci, captures: [...captures, { name: '', regex: '' }] } })}><Plus size={13} /> capture</Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-rule-soft p-4">
                <span className="font-display text-[1.5rem] text-violet">2 · CD</span>
                <Field label="CD job path"><Input value={cfg.cd.jobPath} onChange={(e) => setCfg({ ...cfg, cd: { ...cfg.cd, jobPath: e.target.value } })} placeholder="folder/my-service-cd" /></Field>
                <Field label="Parameters (templated)" hint={<>Use ${'{'}ci.VERSION{'}'}, ${'{'}ci.buildNumber{'}'}, ${'{'}ci.param.BRANCH{'}'}, ${'{'}env{'}'}, ${'{'}service{'}'}</>}>
                  <textarea rows={5} className="devtools-input font-mono" value={cfg.cd.params} onChange={(e) => setCfg({ ...cfg, cd: { ...cfg.cd, params: e.target.value } })} />
                </Field>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-rule-soft p-4">
                <span className="font-display text-[1.5rem] text-warm">3 · Proceed & tag</span>
                <Field label="Approval gate">
                  <Segmented id="proceed-mode" value={cfg.proceed} onChange={(v) => setCfg({ ...cfg, proceed: v })} options={[{ id: 'manual', label: 'Ask me' }, { id: 'auto', label: 'Auto-proceed' }]} />
                </Field>
                {cfg.proceed === 'auto' && <div className="rounded-xl bg-warm/10 px-3 py-2 text-[0.8125rem] text-warm">Auto-proceed clicks Proceed for you on every input step of this CD build. Use it for lower environments only.</div>}
                <Field label="Input values (KEY=value)" hint="Sent with Proceed when the input step asks for parameters (e.g. CHANGE_REF).">
                  <textarea rows={2} className="devtools-input font-mono" value={cfg.proceedParams} onChange={(e) => setCfg({ ...cfg, proceedParams: e.target.value })} placeholder="CHANGE_REF=CHG-1234" />
                </Field>
                <Toggle checked={cfg.saveToBoard} onChange={(v) => setCfg({ ...cfg, saveToBoard: v })} label="Save helm tag to Rehydration Board" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!running ? (
                <Button variant="primary" onClick={start} className="!px-7 !py-3 !text-[1.0625rem]"><Rocket size={18} weight="fill" /> Run flow</Button>
              ) : (
                <Button onClick={cancel} className="!text-rose"><Stop size={16} weight="fill" /> Cancel flow</Button>
              )}
              <Button onClick={save}>{savedNote ?? (selected ? 'Save changes' : 'Save flow')}</Button>
              {selected && <Button variant="ghost" onClick={remove} className="!text-rose"><Trash size={15} /> Delete</Button>}
              <Button variant="ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify({ name, ...cfg }, null, 2))}><Copy size={15} /> Copy JSON</Button>
            </div>
            {error && <ErrorBanner message={error} />}
          </div>
        </Panel>

        {run.status !== 'idle' && (
          <div ref={runPanelRef} className="scroll-mt-2">
          <Panel>
            <div className="flex flex-col gap-4 p-5">
              <FlowRail run={run} />
              <AnimatePresence>
                {pendingApproval && (
                  <InputCard
                    key={pendingApproval.id}
                    input={pendingApproval}
                    busy={false}
                    onAct={(action, params) => approvalRef.current?.({ action, params: { ...parseKv(cfg.proceedParams, run.ctx), ...params } })}
                  />
                )}
              </AnimatePresence>
              {run.helm?.best && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="rounded-3xl border border-violet/50 bg-violet/[0.08] p-5 text-center">
                  <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-violet">{cfg.service} · {cfg.environment} · helm tag</div>
                  <div className="font-mono mt-1 break-all text-[2rem] font-bold text-ink">{run.helm.best}</div>
                  <div className="mt-2 flex justify-center"><Button onClick={() => navigator.clipboard.writeText(run.helm!.best!)}><Copy size={15} /> Copy</Button></div>
                </motion.div>
              )}
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                <div>
                  <SectionLabel>Flow log</SectionLabel>
                  <div className="max-h-80 overflow-y-auto rounded-2xl border border-rule-soft bg-glass p-3 font-mono text-[0.8125rem] leading-relaxed">
                    {run.log.map((l, i) => (
                      <div key={i} className={l.tone === 'ok' ? 'text-emerald' : l.tone === 'bad' ? 'text-rose' : l.tone === 'warn' ? 'text-warm' : 'text-ink-soft'}>
                        <span className="text-ink-faint">{new Date(l.at).toLocaleTimeString()} </span>{l.text}
                      </div>
                    ))}
                  </div>
                  {Object.keys(run.ctx).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(run.ctx).map(([k, v]) => <Badge key={k} tone="cyan">{k}={v}</Badge>)}
                    </div>
                  )}
                </div>
                {serverId && (run.cdBuild || run.ciBuild) && (
                  <div className="min-w-0 rounded-2xl border border-rule-soft p-3">
                    <SectionLabel>{run.cdBuild ? `CD ${cfg.cd.jobPath}` : `CI ${cfg.ci.jobPath}`}</SectionLabel>
                    <BuildMonitor
                      key={run.cdBuild ? `cd${run.cdBuild}` : `ci${run.ciBuild}`}
                      serverId={serverId}
                      serverName={server?.name}
                      jobPath={run.cdBuild ? cfg.cd.jobPath : cfg.ci.jobPath}
                      number={(run.cdBuild ?? run.ciBuild)!}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          </Panel>
          </div>
        )}
      </div>
    </div>
  )
}

function FlowRail({ run }: { run: RunState }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2">
      {STEP_LABELS.map((s, i) => {
        const st = run.steps[s.id]
        const Icon = s.icon
        const styles: Record<StepState, string> = {
          idle: 'ring-rule-soft text-ink-faint',
          running: 'ring-cyan/60 text-cyan stage-running',
          waiting: 'ring-warm/70 text-warm bg-warm/10 stage-waiting',
          done: 'ring-emerald/50 text-emerald bg-emerald/10',
          failed: 'ring-rose/60 text-rose bg-rose/10',
          skipped: 'ring-rule-soft text-ink-faint line-through decoration-ink-faint/40',
        }
        const extra = s.id === 'ci' && run.ciBuild ? `#${run.ciBuild}` : s.id === 'cd' && run.cdBuild ? `#${run.cdBuild}` : s.id === 'helm' && run.helm?.best ? run.helm.best : ''
        return (
          <div key={s.id} className="flex shrink-0 items-center">
            <motion.div
              animate={st === 'done' ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.45 }}
              className={`flex min-w-[9.5rem] flex-col items-center gap-1 rounded-2xl px-3 py-3 ring-1 ${styles[st]}`}
            >
              {st === 'running' ? <CircleNotch size={24} weight="bold" className="animate-spin" /> : st === 'failed' ? <XCircle size={24} weight="fill" /> : st === 'done' ? <CheckCircle size={24} weight="fill" /> : <Icon size={24} weight="duotone" />}
              <span className="text-[0.875rem] font-semibold text-ink">{s.label}</span>
              <span className="max-w-[9rem] truncate font-mono text-[0.75rem]">{extra || st}</span>
            </motion.div>
            {i < STEP_LABELS.length - 1 && <div className={`flow-connector mx-1 h-0.5 w-8 shrink-0 ${st === 'done' || st === 'skipped' ? 'active' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

// =====================================================================================
// Helm tag finder: patterns editor + extraction from a build or pasted log
// =====================================================================================

function HelmFinderView({ server, servers }: { server: JenkinsServer | null; servers: JenkinsServer[] }) {
  const [patterns, setPatterns] = useState<PatternDef[]>([])
  const [custom, setCustom] = useState(() => loadCustomPatterns() !== null)
  const [mode, setMode] = useState<'build' | 'paste'>('build')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ r: HelmResult; jobPath?: string; number?: number; serverName?: string; params?: { name: string; value: string }[]; buildUrl?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const c = loadCustomPatterns()
    if (c) setPatterns(c)
    else defaultHelmPatterns().then(setPatterns).catch(() => {})
  }, [])

  function edit(next: PatternDef[]) {
    setPatterns(next)
    saveCustomPatterns(next)
    setCustom(true)
  }

  async function reset() {
    saveCustomPatterns(null)
    setCustom(false)
    setPatterns(await defaultHelmPatterns())
  }

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      if (mode === 'paste') {
        setResult({ r: await extractHelmTagFromText(text, patterns) })
      } else {
        const ref = parseBuildUrl(url, server ? [server, ...servers.filter((s) => s.id !== server.id)] : servers)
        if (!ref || ref.number == null) throw new Error('Paste a full build URL, e.g. https://jenkins/job/team/job/app-cd/42/')
        const s = servers.find((x) => x.id === ref.serverId)
        const [r, b] = await Promise.all([extractHelmTag(ref.serverId, ref.jobPath, ref.number, patterns), getBuild(ref.serverId, ref.jobPath, ref.number)])
        setResult({ r, jobPath: ref.jobPath, number: ref.number, serverName: s?.name, params: b.parameters, buildUrl: b.url })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-xl:[&>*]:shrink-0 xl:flex-row xl:overflow-hidden">
      <Panel className="xl:w-[min(30rem,40%)] xl:shrink-0">
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 [&>*]:shrink-0">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Patterns {custom ? '(customised)' : '(defaults)'}</SectionLabel>
            {custom && <Button variant="ghost" onClick={reset}>Reset to defaults</Button>}
          </div>
          <p className="text-[0.875rem] leading-relaxed text-ink-faint">
            Checked top to bottom — the first pattern that matches wins, and within a pattern the <b>last</b> occurrence wins (so retries take their final value). Group 1, or a group named <code className="font-mono">tag</code>, is the value.
          </p>
          {patterns.map((p, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-xl border border-rule-soft p-2">
              <div className="flex gap-1.5">
                <Input value={p.name} onChange={(e) => edit(patterns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="!py-1.5" />
                <button disabled={i === 0} onClick={() => { const n = [...patterns]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; edit(n) }} className="px-1 text-ink-faint hover:text-ink disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => edit(patterns.filter((_, j) => j !== i))} className="px-1 text-ink-faint hover:text-rose" aria-label="Remove pattern"><Trash size={15} /></button>
              </div>
              <Input value={p.regex} onChange={(e) => edit(patterns.map((x, j) => (j === i ? { ...x, regex: e.target.value } : x)))} className="!py-1.5 font-mono !text-[0.8125rem]" />
            </div>
          ))}
          <Button variant="ghost" onClick={() => edit([{ name: 'My pattern', regex: 'DEPLOYED_TAG=(\\S+)' }, ...patterns])}><Plus size={14} /> Add pattern (on top)</Button>
        </div>
      </Panel>
      <Panel className="min-w-0 flex-1">
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 [&>*]:shrink-0">
          <Segmented id="helm-mode" value={mode} onChange={setMode} options={[{ id: 'build', label: 'From a Jenkins build' }, { id: 'paste', label: 'From pasted console text' }]} />
          {mode === 'build' ? (
            <Field label="Build URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder={`${server?.baseUrl ?? 'https://jenkins'}/job/platform/job/order-service-cd/42/`} /></Field>
          ) : (
            <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a console log here…" className="!flex-none h-56" />
          )}
          <div><Button variant="primary" onClick={run} disabled={busy || (mode === 'build' ? !url.trim() : !text.trim())}>{busy ? <CircleNotch size={16} className="animate-spin" /> : <Tag size={16} weight="bold" />} Find helm tag</Button></div>
          {error && <ErrorBanner message={error} />}
          {result && <HelmResultView key={JSON.stringify(result.r.best) + (result.number ?? '')} result={result.r} serverName={result.serverName} jobPath={result.jobPath} number={result.number} params={result.params} buildUrl={result.buildUrl} />}
        </div>
      </Panel>
    </div>
  )
}

// =====================================================================================
// Servers
// =====================================================================================

function ServersView({ servers, onChange, onAddDemo, onSelect }: { servers: JenkinsServer[]; onChange: () => void; onAddDemo: () => void; onSelect: (id: number) => void }) {
  const [editing, setEditing] = useState<JenkinsServer | null>(null)
  const [form, setForm] = useState({ name: '', baseUrl: '', username: '', apiToken: '', trustAllCerts: false })
  const [status, setStatus] = useState<Record<number, { ok: boolean; text: string } | 'busy'>>({})
  const [error, setError] = useState<string | null>(null)

  function startEdit(s: JenkinsServer | null) {
    setEditing(s)
    setForm(s ? { name: s.name, baseUrl: s.baseUrl, username: s.username ?? '', apiToken: '', trustAllCerts: s.trustAllCerts } : { name: '', baseUrl: '', username: '', apiToken: '', trustAllCerts: false })
  }

  async function save() {
    setError(null)
    try {
      const s = editing ? await updateServer(editing.id, form) : await createServer(form)
      onChange()
      startEdit(null)
      test(s.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function test(id: number) {
    setStatus((s) => ({ ...s, [id]: 'busy' }))
    try {
      const r = await testServer(id)
      setStatus((s) => ({ ...s, [id]: { ok: true, text: `Connected · Jenkins ${r.version} as ${r.user}` } }))
    } catch (e) {
      setStatus((s) => ({ ...s, [id]: { ok: false, text: e instanceof Error ? e.message : 'failed' } }))
    }
  }

  const stats = useMemo(() => ({ total: servers.length, demo: servers.filter((s) => s.demo).length }), [servers])

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-lg:[&>*]:shrink-0 lg:flex-row">
      <Panel className="lg:w-[min(28rem,42%)] lg:shrink-0">
        <div className="flex flex-col gap-3 p-5">
          <div className="font-display text-[1.75rem] text-ink">{editing ? `Edit ${editing.name}` : 'Add a Jenkins server'}</div>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jenkins Core" /></Field>
          <Field label="Base URL" hint="The URL of the Jenkins dashboard, e.g. https://jenkins.mycorp.net or https://ci.mycorp.net/jenkins"><Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://jenkins.example.com" /></Field>
          <Field label="Username"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="your Jenkins user id" /></Field>
          <Field label="API token" hint={editing?.hasToken ? 'Stored. Leave blank to keep it.' : 'Jenkins → your name → Security → API Token → Add new token.'}>
            <Input type="password" value={form.apiToken} onChange={(e) => setForm({ ...form, apiToken: e.target.value })} placeholder={editing?.hasToken ? '•••••••• (unchanged)' : '11xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'} />
          </Field>
          <Toggle checked={form.trustAllCerts} onChange={(v) => setForm({ ...form, trustAllCerts: v })} label="Trust self-signed TLS certificates" />
          {form.trustAllCerts && <div className="rounded-xl bg-warm/10 px-3 py-2 text-[0.8125rem] text-warm">Only for an internal Jenkins you trust: certificate checks are skipped for this server.</div>}
          {error && <ErrorBanner message={error} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={save} disabled={!form.name || !form.baseUrl}>{editing ? 'Save changes' : 'Add server'}</Button>
            {editing && <Button variant="ghost" onClick={() => startEdit(null)}>Cancel</Button>}
          </div>
          <div className="mt-2 rounded-2xl border border-dashed border-rule p-3 text-[0.875rem] text-ink-faint">
            Tokens are stored in this app's local database and only ever sent to that Jenkins. Want a sandbox first?
            <div className="mt-2"><Button onClick={onAddDemo}><Flask size={15} weight="bold" /> Add demo Jenkins</Button></div>
          </div>
        </div>
      </Panel>
      <div className="flex min-w-0 flex-1 flex-col gap-3 [&>*]:shrink-0">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label="Servers" value={stats.total} />
          <StatTile label="Demo" value={stats.demo} tone="violet" />
        </div>
        {servers.map((s) => {
          const st = status[s.id]
          return (
            <Panel key={s.id}>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[1.0625rem] font-semibold text-ink">{s.name}</span>
                    {s.demo && <Badge tone="violet">demo</Badge>}
                    {s.trustAllCerts && <Badge tone="warm">self-signed ok</Badge>}
                  </div>
                  <div className="truncate font-mono text-[0.875rem] text-ink-faint">{s.baseUrl}</div>
                  <div className="text-[0.8125rem] text-ink-faint">{s.username ? `as ${s.username}` : 'anonymous'} · {s.hasToken ? 'token stored' : 'no token'}</div>
                  {st && st !== 'busy' && <div className={`mt-1 text-[0.875rem] ${st.ok ? 'text-emerald' : 'text-rose'}`}>{st.text}</div>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="primary" onClick={() => onSelect(s.id)}>Open</Button>
                  <Button onClick={() => test(s.id)} disabled={st === 'busy'}>{st === 'busy' ? <CircleNotch size={15} className="animate-spin" /> : <PlugsConnected size={15} />} Test</Button>
                  <Button variant="ghost" onClick={() => startEdit(s)}>Edit</Button>
                  <Button variant="ghost" onClick={async () => { await deleteServer(s.id); onChange() }} className="!text-rose"><Trash size={15} /></Button>
                </div>
              </div>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

