import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Clock,
  FloppyDisk,
  HandPalm,
  MagnifyingGlass,
  Pause,
  Play,
  Prohibit,
  Stop,
  Tag,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'
import {
  createRecord,
  defaultValue,
  extractHelmTag,
  fmtDuration,
  getBuild,
  getLog,
  guessEnv,
  guessService,
  loadCustomPatterns,
  resultTone,
  stopBuild,
  submitInput,
  type BuildInfo,
  type HelmResult,
  type ParamDef,
  type PendingInput,
  type Stage,
} from '../lib/jenkinsApi'
import { Badge, Button, CopyButton, ErrorBanner, Field, Input, Select, SectionLabel, Toggle } from './ui'
import { celebrate } from './CursorFx'

// ------------------------------------------------------------------ status bits

export function StatusDot({ tone, building }: { tone: string; building?: boolean }) {
  const color = { emerald: 'bg-emerald', rose: 'bg-rose', warm: 'bg-warm', cyan: 'bg-cyan', violet: 'bg-violet', muted: 'bg-ink-faint' }[tone] ?? 'bg-ink-faint'
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      {building && <span className={`absolute inset-0 animate-ping rounded-full ${color} opacity-60`} />}
      <span className={`relative h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  )
}

export function ResultBadge({ result, building, paused }: { result: string | null; building: boolean; paused?: boolean }) {
  if (paused) return <Badge tone="warm"><HandPalm size={12} weight="fill" /> Waiting for approval</Badge>
  if (building) return <Badge tone="cyan"><CircleNotch size={12} weight="bold" className="animate-spin" /> Running</Badge>
  const tone = resultTone(result)
  const icon = result === 'SUCCESS' ? <CheckCircle size={12} weight="fill" /> : result === 'FAILURE' ? <XCircle size={12} weight="fill" /> : <Prohibit size={12} weight="bold" />
  return <Badge tone={tone}>{icon} {result ?? 'Unknown'}</Badge>
}

function stageStyle(status: string) {
  switch (status) {
    case 'SUCCESS': return { ring: 'ring-emerald/40', bg: 'bg-emerald/10', text: 'text-emerald', icon: <CheckCircle size={17} weight="fill" /> }
    case 'FAILED': return { ring: 'ring-rose/50', bg: 'bg-rose/10', text: 'text-rose', icon: <XCircle size={17} weight="fill" /> }
    case 'UNSTABLE': return { ring: 'ring-warm/50', bg: 'bg-warm/10', text: 'text-warm', icon: <WarningCircle size={17} weight="fill" /> }
    case 'IN_PROGRESS': return { ring: 'ring-cyan/60', bg: 'stage-running', text: 'text-cyan', icon: <CircleNotch size={17} weight="bold" className="animate-spin" /> }
    case 'PAUSED_PENDING_INPUT': return { ring: 'ring-warm/70', bg: 'bg-warm/10 stage-waiting', text: 'text-warm', icon: <Pause size={17} weight="fill" /> }
    case 'ABORTED': return { ring: 'ring-rule', bg: 'bg-glass', text: 'text-ink-faint', icon: <Prohibit size={17} weight="bold" /> }
    default: return { ring: 'ring-rule-soft', bg: 'bg-transparent', text: 'text-ink-faint', icon: <Clock size={17} weight="light" /> }
  }
}

/** Horizontal stage-view rail — same information as Jenkins' Stage View, but alive. */
export function StageRail({ stages, compact }: { stages: Stage[]; compact?: boolean }) {
  if (stages.length === 0) return null
  return (
    <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
      {stages.map((s, i) => {
        const st = stageStyle(s.status)
        const active = s.status === 'IN_PROGRESS' || s.status === 'PAUSED_PENDING_INPUT'
        return (
          <div key={s.id + s.name} className="flex shrink-0 items-center">
            <motion.div
              layout
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26, delay: i * 0.04 }}
              className={`relative flex flex-col gap-1 rounded-2xl px-3.5 py-2.5 ring-1 ${st.ring} ${st.bg} ${compact ? 'min-w-[8.5rem]' : 'min-w-[10.5rem]'}`}
            >
              <div className={`flex items-center gap-1.5 ${st.text}`}>
                {st.icon}
                <span className="truncate text-[0.9375rem] font-semibold text-ink">{s.name}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[0.8125rem] text-ink-faint">
                <span>{s.status === 'NOT_EXECUTED' ? 'pending' : s.status === 'PAUSED_PENDING_INPUT' ? 'awaiting input' : s.status.toLowerCase().replace(/_/g, ' ')}</span>
                <span className="font-mono">{s.durationMillis > 0 ? fmtDuration(s.durationMillis) : ''}</span>
              </div>
            </motion.div>
            {i < stages.length - 1 && (
              <div className={`flow-connector mx-1 h-0.5 w-7 shrink-0 ${active || s.status === 'SUCCESS' ? 'active' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ params

export function ParamForm({
  defs,
  values,
  onChange,
}: {
  defs: ParamDef[]
  values: Record<string, string>
  onChange: (v: Record<string, string>) => void
}) {
  if (defs.length === 0) return <div className="text-[0.875rem] text-ink-faint">This job takes no parameters.</div>
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {defs.map((p) => {
        const v = values[p.name] ?? defaultValue(p)
        const set = (val: string) => onChange({ ...values, [p.name]: val })
        const type = p.type ?? ''
        const hint = p.description || undefined
        if (/Boolean/.test(type))
          return (
            <div key={p.name} className="flex flex-col justify-center gap-1 rounded-xl border border-rule-soft px-3 py-2">
              <Toggle checked={v === 'true'} onChange={(b) => set(String(b))} label={p.name} />
              {hint && <span className="text-[0.8125rem] text-ink-faint">{hint}</span>}
            </div>
          )
        if (/Choice/.test(type) && p.choices?.length)
          return (
            <Field key={p.name} label={p.name} hint={hint}>
              <Select value={v} onChange={(e) => set(e.target.value)}>
                {p.choices.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
          )
        if (/Text/.test(type))
          return (
            <Field key={p.name} label={p.name} hint={hint} className="lg:col-span-2">
              <textarea value={v} onChange={(e) => set(e.target.value)} rows={4} spellCheck={false} className="devtools-input font-mono" />
            </Field>
          )
        return (
          <Field key={p.name} label={p.name} hint={hint}>
            <Input type={/Password/.test(type) ? 'password' : 'text'} value={v} onChange={(e) => set(e.target.value)} />
          </Field>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ pending input

export function InputCard({
  input,
  busy,
  onAct,
}: {
  input: PendingInput
  busy: boolean
  onAct: (action: 'proceed' | 'abort', params: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(input.inputs.map((f) => [f.name, f.defaultValue ?? ''])))
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="stage-waiting rounded-3xl border border-warm/50 bg-warm/[0.08] p-4"
    >
      <div className="mb-1 flex items-center gap-2 text-warm">
        <HandPalm size={20} weight="fill" />
        <span className="text-[0.75rem] font-extrabold uppercase tracking-[0.16em]">Pipeline is waiting for you</span>
      </div>
      <div className="mb-3 text-[1.125rem] font-semibold text-ink">{input.message || 'Proceed?'}</div>
      {input.inputs.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {input.inputs.map((f) => (
            <Field key={f.name} label={f.name} hint={f.description || undefined}>
              {f.choices?.length ? (
                <Select value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                  {f.choices.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              ) : /Boolean/.test(f.type) ? (
                <Toggle checked={values[f.name] === 'true'} onChange={(b) => setValues({ ...values, [f.name]: String(b) })} label="" />
              ) : (
                <Input value={values[f.name] ?? ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={busy} onClick={() => onAct('proceed', values)} className="!px-6">
          {busy ? <CircleNotch size={16} className="animate-spin" /> : <Play size={16} weight="fill" />} {input.proceedText || 'Proceed'}
        </Button>
        <Button disabled={busy} onClick={() => onAct('abort', {})} className="!text-rose">
          <Stop size={16} weight="fill" /> Abort
        </Button>
        <span className="text-[0.8125rem] text-ink-faint">input id: <span className="font-mono">{input.id}</span></span>
      </div>
    </motion.div>
  )
}

// ------------------------------------------------------------------ console

function lineClass(line: string): string {
  if (/\b(ERROR|FAILURE|FAILED|Exception)\b|exit code [1-9]/.test(line)) return 'text-rose'
  if (/WARN/.test(line)) return 'text-warm'
  if (/HELM_TAG|helm (upgrade|install|package|push)|Pushed:|CHART_VERSION|Successfully packaged/i.test(line)) return 'text-violet font-semibold'
  if (/^Finished: SUCCESS|BUILD SUCCESS|Approved by/.test(line)) return 'text-emerald font-semibold'
  if (/^\[Pipeline\]/.test(line)) return 'text-ink-faint'
  if (/^\+ /.test(line)) return 'text-cyan'
  return 'text-ink-soft'
}

export function ConsoleView({ text, follow, filter, height = '26rem' }: { text: string; follow: boolean; filter: string; height?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const lines = useMemo(() => {
    const all = text.split('\n')
    if (all[all.length - 1] === '') all.pop()
    if (!filter.trim()) return all.map((l, i) => [i + 1, l] as const)
    const q = filter.toLowerCase()
    return all.map((l, i) => [i + 1, l] as const).filter(([, l]) => l.toLowerCase().includes(q))
  }, [text, filter])
  useEffect(() => {
    if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines, follow])
  return (
    <div ref={ref} style={{ height }} className="overflow-auto rounded-2xl border border-rule bg-[color-mix(in_srgb,var(--void)_80%,transparent)] p-3 font-mono text-[0.8125rem] leading-[1.6] shadow-[var(--shadow-inset)]">
      {lines.length === 0 && <div className="text-ink-faint">{filter ? 'No lines match the filter.' : 'Waiting for console output…'}</div>}
      {lines.map(([n, l]) => (
        <div key={n} className="flex gap-3 whitespace-pre-wrap break-all">
          <span className="w-10 shrink-0 select-none text-right text-ink-faint">{n}</span>
          <span className={lineClass(l)}>{l || ' '}</span>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ helm extraction

export function HelmResultView({
  result,
  serverName,
  jobPath,
  number,
  buildUrl,
  params,
  onSaved,
}: {
  result: HelmResult
  serverName?: string
  jobPath?: string
  number?: number
  buildUrl?: string
  params?: { name: string; value: string }[]
  onSaved?: () => void
}) {
  const release = result.releases[result.releases.length - 1]
  const [service, setService] = useState(release?.release ?? (jobPath ? guessService(jobPath) : ''))
  const [env, setEnv] = useState(params ? guessEnv(params) : '')
  const [tag, setTag] = useState(result.best ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await createRecord({
        service,
        environment: env,
        helmTag: tag,
        chart: release?.chart ?? null,
        chartVersion: release?.version ?? null,
        imageTag: release?.imageTag ?? result.matches.find((m) => /image/i.test(m.pattern))?.value ?? null,
        namespace: release?.namespace ?? null,
        serverName: serverName ?? null,
        jobPath: jobPath ?? null,
        buildNumber: number ?? null,
        buildUrl: buildUrl ?? null,
      })
      setSaved(true)
      celebrate()
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const uniqueValues = Array.from(new Set(result.matches.map((m) => m.value)))

  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-3xl border p-5 ${result.best ? 'border-violet/50 bg-violet/[0.08]' : 'border-rose/40 bg-rose/[0.06]'}`}
      >
        <div className="flex items-center gap-2 text-[0.75rem] font-extrabold uppercase tracking-[0.16em] text-violet">
          <Tag size={14} weight="fill" /> Helm tag
        </div>
        {result.best ? (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="font-mono break-all text-[1.75rem] font-bold text-ink">{result.best}</span>
            <CopyButton text={result.best} />
          </div>
        ) : (
          <div className="mt-1 text-[1rem] text-ink-soft">No helm tag found in {result.linesScanned.toLocaleString()} lines. Add a pattern below that matches how your pipeline prints it.</div>
        )}
        {result.bestSource && <div className="mt-1 text-[0.875rem] text-ink-faint">from {result.bestSource} · scanned {result.linesScanned.toLocaleString()} lines</div>}
        {uniqueValues.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[0.8125rem] text-ink-faint">Other candidates:</span>
            {uniqueValues.filter((v) => v !== result.best).map((v) => (
              <button key={v} onClick={() => setTag(v)} className="rounded-full bg-glass px-2.5 py-0.5 font-mono text-[0.8125rem] text-ink-soft ring-1 ring-rule hover:text-ink">
                {v}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {result.patternErrors.length > 0 && <ErrorBanner message={`Invalid pattern(s): ${result.patternErrors.join('; ')}`} />}

      {result.releases.length > 0 && (
        <div>
          <SectionLabel>helm upgrade / install commands found</SectionLabel>
          <div className="overflow-x-auto rounded-2xl border border-rule-soft">
            <table className="w-full text-left text-[0.875rem]">
              <thead className="bg-glass text-[0.75rem] uppercase tracking-wider text-ink-faint">
                <tr><th className="px-3 py-2">Release</th><th className="px-3 py-2">Chart</th><th className="px-3 py-2">--version</th><th className="px-3 py-2">image.tag</th><th className="px-3 py-2">Namespace</th><th className="px-3 py-2">Line</th></tr>
              </thead>
              <tbody>
                {result.releases.map((r, i) => (
                  <tr key={i} className="border-t border-rule-soft">
                    <td className="px-3 py-2 font-semibold text-ink">{r.release ?? '—'}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 font-mono text-ink-soft" title={r.chart ?? ''}>{r.chart ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-violet">{r.version ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-ink-soft">{r.imageTag ?? '—'}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.namespace ?? '—'}</td>
                    <td className="px-3 py-2 text-ink-faint">{r.lineNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-rule-soft p-4">
        <SectionLabel>Save to Rehydration Board</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Service"><Input value={service} onChange={(e) => setService(e.target.value)} placeholder="order-service" /></Field>
          <Field label="Environment"><Input value={env} onChange={(e) => setEnv(e.target.value.toUpperCase())} placeholder="UAT" /></Field>
          <Field label="Helm tag"><Input value={tag} onChange={(e) => setTag(e.target.value)} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={save} disabled={saving || !service || !env || !tag || saved}>
            <FloppyDisk size={16} weight="bold" /> {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save tag'}
          </Button>
          {error && <span className="text-[0.875rem] text-rose">{error}</span>}
        </div>
      </div>

      {result.matches.length > 0 && (
        <details className="rounded-2xl border border-rule-soft p-3">
          <summary className="cursor-pointer text-[0.875rem] font-semibold text-ink-soft">All {result.matches.length} matches</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {result.matches.map((m, i) => (
              <div key={i} className="rounded-xl bg-glass px-3 py-2 text-[0.8125rem]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="violet">{m.pattern}</Badge>
                  <span className="font-mono font-semibold text-ink">{m.value}</span>
                  {m.lineNumber > 0 && <span className="text-ink-faint">line {m.lineNumber}</span>}
                </div>
                <div className="mt-1 break-all font-mono text-ink-faint">{m.line}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ build monitor

export function useBuildPoller(serverId: number | null, jobPath: string, number: number | null) {
  const [build, setBuild] = useState<BuildInfo | null>(null)
  const [log, setLog] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    setBuild(null)
    setLog('')
    setError(null)
    startRef.current = 0
  }, [serverId, jobPath, number])

  useEffect(() => {
    if (serverId == null || number == null) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const [b, l] = await Promise.all([getBuild(serverId!, jobPath, number!), getLog(serverId!, jobPath, number!, startRef.current)])
        if (cancelled) return
        setBuild(b)
        if (l.text) {
          setLog((prev) => {
            const next = startRef.current === 0 ? l.text : prev + l.text
            return next.length > 2_000_000 ? next.slice(-2_000_000) : next
          })
        }
        startRef.current = l.nextStart
        setError(null)
        if (b.building || l.more) timer = setTimeout(poll, 1500)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Polling failed')
        timer = setTimeout(poll, 5000)
      }
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [serverId, jobPath, number, tick])

  return { build, log, error, refresh: () => setTick((t) => t + 1) }
}

export function BuildMonitor({
  serverId,
  serverName,
  jobPath,
  number,
  onRebuild,
  compact,
  onBuild,
}: {
  serverId: number
  serverName?: string
  jobPath: string
  number: number
  onRebuild?: (params: Record<string, string>) => void
  compact?: boolean
  onBuild?: (b: BuildInfo) => void
}) {
  const { build, log, error, refresh } = useBuildPoller(serverId, jobPath, number)
  const [follow, setFollow] = useState(true)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [helm, setHelm] = useState<HelmResult | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [tab, setTab] = useState<'console' | 'helm' | 'details'>('console')
  const prevResult = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!build) return
    onBuild?.(build)
    if (prevResult.current === null && build.result === 'SUCCESS') celebrate()
    prevResult.current = build.building ? null : build.result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build])

  useEffect(() => {
    setHelm(null)
    setTab('console')
  }, [serverId, jobPath, number])

  async function act(action: 'proceed' | 'abort', inputId: string, params: Record<string, string>) {
    setBusy(true)
    setActionError(null)
    try {
      await submitInput(serverId, jobPath, number, inputId, action, params)
      refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Input failed')
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    setBusy(true)
    try {
      await stopBuild(serverId, jobPath, number)
      refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Stop failed')
    } finally {
      setBusy(false)
    }
  }

  async function extract() {
    setExtracting(true)
    setActionError(null)
    setTab('helm')
    try {
      setHelm(await extractHelmTag(serverId, jobPath, number, loadCustomPatterns() ?? undefined))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  const paused = !!build?.pendingInputs?.length
  const elapsed = build ? (build.building ? Date.now() - build.timestamp : build.duration) : 0
  const pct = build && build.estimatedDuration > 0 ? Math.min(100, (elapsed / build.estimatedDuration) * 100) : null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-display text-[1.9rem] leading-none text-ink">#{number}</span>
        {build ? <ResultBadge result={build.result} building={build.building} paused={paused} /> : <Badge>loading…</Badge>}
        {build && <span className="text-[0.875rem] text-ink-faint">{build.building ? 'running for' : 'took'} {fmtDuration(elapsed)}</span>}
        {build?.description && <Badge tone="violet">{build.description}</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {build?.building && (
            <Button variant="ghost" onClick={stop} disabled={busy} className="!text-rose">
              <Stop size={15} weight="fill" /> Stop
            </Button>
          )}
          {onRebuild && build && !build.building && (
            <Button variant="ghost" onClick={() => onRebuild(Object.fromEntries(build.parameters.map((p) => [p.name, p.value])))}>
              <Play size={15} weight="fill" /> Rebuild
            </Button>
          )}
          <Button onClick={extract} disabled={extracting || !build}>
            {extracting ? <CircleNotch size={15} className="animate-spin" /> : <Tag size={15} weight="bold" />} Get helm tag
          </Button>
          {build?.url && (
            <a href={build.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.875rem] font-semibold text-ink-soft hover:bg-glass hover:text-ink">
              <ArrowSquareOut size={15} /> Jenkins
            </a>
          )}
        </div>
      </div>

      {pct !== null && build?.building && (
        <div className="h-1.5 overflow-hidden rounded-full bg-glass">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan via-violet to-rose" animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 60, damping: 20 }} />
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      {actionError && <ErrorBanner message={actionError} />}

      {build && build.stages.length > 0 && <StageRail stages={build.stages} compact={compact} />}
      {build && !build.hasStageApi && (
        <div className="text-[0.875rem] text-ink-faint">No stage view for this job (freestyle job, or the Pipeline Stage View plugin isn't installed) — console below.</div>
      )}

      <AnimatePresence>
        {build?.pendingInputs?.map((inp) => (
          <InputCard key={inp.id} input={inp} busy={busy} onAct={(a, p) => act(a, inp.id, p)} />
        ))}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2">
        {(['console', 'helm', 'details'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-[0.875rem] font-semibold transition-colors ${tab === t ? 'bg-glass-strong text-ink ring-1 ring-rule' : 'text-ink-faint hover:text-ink-soft'}`}
          >
            {t === 'console' ? 'Console' : t === 'helm' ? 'Helm tag' : 'Parameters & changes'}
          </button>
        ))}
        {tab === 'console' && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="relative">
              <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter lines" className="devtools-input !w-48 !py-1.5 pl-8" />
            </div>
            <Toggle checked={follow} onChange={setFollow} label="Follow" />
            <CopyButton text={log} label="Copy log" />
          </div>
        )}
      </div>

      {tab === 'console' && <ConsoleView text={log} follow={follow} filter={filter} height={compact ? '18rem' : '28rem'} />}
      {tab === 'helm' && (
        <div>
          {extracting && <div className="flex items-center gap-2 text-ink-soft"><CircleNotch className="animate-spin" /> Scanning the full console log…</div>}
          {!extracting && !helm && <div className="text-ink-faint">Click “Get helm tag” to scan this build's console, parameters and description.</div>}
          {helm && build && (
            <HelmResultView
              result={helm}
              serverName={serverName}
              jobPath={jobPath}
              number={number}
              buildUrl={build.url}
              params={build.parameters}
            />
          )}
        </div>
      )}
      {tab === 'details' && build && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <SectionLabel>Parameters</SectionLabel>
            {build.parameters.length === 0 ? <div className="text-ink-faint">none</div> : (
              <div className="flex flex-col gap-1">
                {build.parameters.map((p) => (
                  <div key={p.name} className="flex gap-3 rounded-xl bg-glass px-3 py-1.5 text-[0.875rem]">
                    <span className="shrink-0 font-semibold text-ink-soft">{p.name}</span>
                    <span className="min-w-0 break-all font-mono text-ink">{p.value || '""'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-[0.875rem] text-ink-faint">{build.causes.join(' · ')}</div>
          </div>
          <div>
            <SectionLabel>Changes</SectionLabel>
            {build.changes.length === 0 ? <div className="text-ink-faint">none</div> : build.changes.map((c) => (
              <div key={c.commitId} className="mb-1 rounded-xl bg-glass px-3 py-1.5 text-[0.875rem]">
                <span className="font-mono text-cyan">{c.commitId.slice(0, 8)}</span> <span className="text-ink">{c.msg}</span> <span className="text-ink-faint">— {c.author}</span>
              </div>
            ))}
            {build.artifacts.length > 0 && (
              <>
                <SectionLabel>Artifacts</SectionLabel>
                {build.artifacts.map((a) => <div key={a.relativePath} className="font-mono text-[0.875rem] text-ink-soft">{a.relativePath}</div>)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
