async function call<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return text ? JSON.parse(text) : (undefined as T)
}

export type JenkinsServer = {
  id: number
  name: string
  baseUrl: string
  username: string | null
  hasToken: boolean
  trustAllCerts: boolean
  demo: boolean
}
export type ServerRequest = { name: string; baseUrl: string; username: string; apiToken: string; trustAllCerts: boolean }

export type JobSummary = {
  _class: string
  name: string
  url: string
  color?: string
  description?: string | null
  lastBuild?: { number: number; result: string | null; timestamp: number; duration: number; building: boolean } | null
}
export type JobList = { name?: string; url?: string; _class?: string; jobs?: JobSummary[] }

export type ParamDef = {
  name: string
  type: string
  description?: string | null
  choices?: string[]
  defaultParameterValue?: { value: unknown } | null
}
export type BuildSummary = {
  number: number
  result: string | null
  building: boolean
  timestamp: number
  duration: number
  displayName?: string
  description?: string | null
}
export type JobDetail = {
  name: string
  fullName?: string
  url: string
  description?: string | null
  color?: string
  _class: string
  buildable?: boolean
  nextBuildNumber?: number
  property?: { parameterDefinitions?: ParamDef[] }[]
  builds?: BuildSummary[]
  jobs?: JobSummary[]
  lastSuccessfulBuild?: { number: number } | null
}

export type Stage = { id: string; name: string; status: string; durationMillis: number; startTimeMillis: number; pauseDurationMillis: number }
export type InputField = { name: string; type: string; description: string; choices: string[]; defaultValue: string }
export type PendingInput = { id: string; message: string; proceedText: string; inputs: InputField[] }
export type BuildInfo = {
  number: number
  url: string
  result: string | null
  building: boolean
  duration: number
  estimatedDuration: number
  timestamp: number
  displayName: string
  description: string | null
  parameters: { name: string; value: string }[]
  causes: string[]
  artifacts: { fileName: string; relativePath: string }[]
  changes: { msg: string; commitId: string; author: string }[]
  hasStageApi: boolean
  stages: Stage[]
  pendingInputs: PendingInput[]
}
export type LogChunk = { text: string; nextStart: number; more: boolean; clipped: boolean }

export type PatternDef = { name: string; regex: string }
export type HelmMatch = { pattern: string; value: string; lineNumber: number; line: string; source: string }
export type HelmRelease = { release: string | null; chart: string | null; version: string | null; imageTag: string | null; namespace: string | null; lineNumber: number }
export type HelmResult = { best: string | null; bestSource: string | null; matches: HelmMatch[]; releases: HelmRelease[]; linesScanned: number; patternErrors: string[] }

export type HelmRecord = {
  id: number
  service: string
  environment: string
  helmTag: string
  chart?: string | null
  chartVersion?: string | null
  imageTag?: string | null
  namespace?: string | null
  serverName?: string | null
  jobPath?: string | null
  buildNumber?: number | null
  buildUrl?: string | null
  notes?: string | null
  capturedAt: string
}
export type JsonDoc = { id: number; kind: string; name: string; body: string; createdAt: string; updatedAt: string }

const B = '/api/jenkins'
const enc = encodeURIComponent

export const listServers = () => call<JenkinsServer[]>(`${B}/servers`)
export const createServer = (r: ServerRequest) => call<JenkinsServer>(`${B}/servers`, 'POST', r)
export const updateServer = (id: number, r: ServerRequest) => call<JenkinsServer>(`${B}/servers/${id}`, 'PUT', r)
export const deleteServer = (id: number) => call<void>(`${B}/servers/${id}`, 'DELETE')
export const createDemoServer = () => call<JenkinsServer>(`${B}/servers/demo`, 'POST')
export const testServer = (id: number) => call<{ version: string; user: string }>(`${B}/servers/${id}/test`, 'POST')

export const listJobs = (id: number, path: string) => call<JobList>(`${B}/servers/${id}/jobs?path=${enc(path)}`)
export const getJob = (id: number, path: string) => call<JobDetail>(`${B}/servers/${id}/job?path=${enc(path)}`)
export const triggerBuild = (id: number, path: string, params: Record<string, string>, parameterized: boolean) =>
  call<{ queueUrl: string; queueId: number | null }>(`${B}/servers/${id}/trigger`, 'POST', { path, params, parameterized })
export const getQueueItem = (id: number, queueId: number) =>
  call<{ why: string | null; cancelled: boolean; buildNumber: number | null; buildUrl: string | null }>(`${B}/servers/${id}/queue/${queueId}`)
export const getBuild = (id: number, path: string, number: number) => call<BuildInfo>(`${B}/servers/${id}/build?path=${enc(path)}&number=${number}`)
export const getLog = (id: number, path: string, number: number, start: number) =>
  call<LogChunk>(`${B}/servers/${id}/log?path=${enc(path)}&number=${number}&start=${start}`)
export const submitInput = (id: number, path: string, number: number, inputId: string, action: 'proceed' | 'abort', params?: Record<string, string>) =>
  call<{ ok: boolean }>(`${B}/servers/${id}/input`, 'POST', { path, number, inputId, action, params: params ?? {} })
export const stopBuild = (id: number, path: string, number: number) => call<{ ok: boolean }>(`${B}/servers/${id}/stop`, 'POST', { path, number })

export const defaultHelmPatterns = () => call<PatternDef[]>(`${B}/helm-patterns/defaults`)
export const extractHelmTag = (id: number, path: string, number: number, patterns?: PatternDef[]) =>
  call<HelmResult>(`${B}/servers/${id}/helm-tag`, 'POST', { path, number, patterns: patterns ?? null })
export const extractHelmTagFromText = (text: string, patterns?: PatternDef[]) =>
  call<HelmResult>(`${B}/helm-tag/from-text`, 'POST', { text, patterns: patterns ?? null })

export const listRecords = () => call<HelmRecord[]>(`${B}/records`)
export const createRecord = (r: Partial<HelmRecord>) => call<HelmRecord>(`${B}/records`, 'POST', r)
export const updateRecord = (id: number, r: Partial<HelmRecord>) => call<HelmRecord>(`${B}/records/${id}`, 'PUT', r)
export const deleteRecord = (id: number) => call<void>(`${B}/records/${id}`, 'DELETE')

export const listDocs = (kind: string) => call<JsonDoc[]>(`${B}/docs/${kind}`)
export const createDoc = (kind: string, name: string, body: unknown) => call<JsonDoc>(`${B}/docs/${kind}`, 'POST', { name, body: JSON.stringify(body) })
export const updateDoc = (kind: string, id: number, name: string, body: unknown) =>
  call<JsonDoc>(`${B}/docs/${kind}/${id}`, 'PUT', { name, body: JSON.stringify(body) })
export const deleteDoc = (kind: string, id: number) => call<void>(`${B}/docs/${kind}/${id}`, 'DELETE')

// ------------------------------------------------------------------ helpers

export function paramDefs(job: JobDetail | null): ParamDef[] {
  return job?.property?.flatMap((p) => p.parameterDefinitions ?? []) ?? []
}

export function defaultValue(p: ParamDef): string {
  const v = p.defaultParameterValue?.value
  if (v === undefined || v === null) return p.choices?.[0] ?? ''
  return String(v)
}

export function isFolder(j: { _class?: string; jobs?: unknown }): boolean {
  const c = j._class ?? ''
  return /Folder|MultiBranch|OrganizationFolder|ComputedFolder/.test(c) || Array.isArray(j.jobs)
}

/** "https://ci/job/a/job/b/57/console" → { jobPath: "a/b", number: 57 } against a known server. */
export function parseBuildUrl(url: string, servers: JenkinsServer[]): { serverId: number; jobPath: string; number: number | null } | null {
  const clean = url.trim()
  const server = servers
    .filter((s) => clean.toLowerCase().startsWith(s.baseUrl.toLowerCase().replace(/\/+$/, '')))
    .sort((a, b) => b.baseUrl.length - a.baseUrl.length)[0]
  const path = server ? clean.slice(server.baseUrl.replace(/\/+$/, '').length) : (() => {
    try {
      return new URL(clean).pathname
    } catch {
      return clean
    }
  })()
  const segs = path.split('/').filter(Boolean)
  const jobs: string[] = []
  let number: number | null = null
  for (let i = 0; i < segs.length; i++) {
    if (segs[i] === 'job' && segs[i + 1]) {
      jobs.push(decodeURIComponent(segs[i + 1]))
      i++
    } else if (/^\d+$/.test(segs[i]) && jobs.length > 0) {
      number = Number(segs[i])
      break
    }
  }
  if (jobs.length === 0) return null
  const fallback = servers.length === 1 ? servers[0] : null
  const s = server ?? fallback
  if (!s) return null
  return { serverId: s.id, jobPath: jobs.join('/'), number }
}

export type StatusTone = 'emerald' | 'rose' | 'warm' | 'cyan' | 'muted' | 'violet'

export function resultTone(result: string | null | undefined, building?: boolean): StatusTone {
  if (building) return 'cyan'
  switch (result) {
    case 'SUCCESS': return 'emerald'
    case 'FAILURE': case 'FAILED': return 'rose'
    case 'UNSTABLE': return 'warm'
    case 'ABORTED': case 'NOT_BUILT': return 'muted'
    default: return 'muted'
  }
}

export function colorTone(color: string | undefined): { tone: StatusTone; building: boolean } {
  if (!color) return { tone: 'muted', building: false }
  const building = color.endsWith('_anime')
  const base = color.replace('_anime', '')
  const tone: StatusTone = base === 'blue' ? 'emerald' : base === 'red' ? 'rose' : base === 'yellow' ? 'warm' : 'muted'
  return { tone, building }
}

export function fmtDuration(ms: number): string {
  if (!ms || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function fmtAgo(ts: number | string): string {
  const t = typeof ts === 'string' ? Date.parse(ts) : ts
  const d = Date.now() - t
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

/** `${ci.VERSION}`, `${env}`, `${service}` … substituted from a context map; unknown names left as-is. */
export function template(value: string, ctx: Record<string, string>): string {
  return value.replace(/\$\{([\w.\-]+)\}/g, (m, k) => (k in ctx ? ctx[k] : m))
}

/** Hand-off so another tool (Rehydration Board) can open a build in Pipeline Studio. */
let pendingOpen: { serverId: number; jobPath: string; number: number | null } | null = null
export function requestOpenBuild(ref: { serverId: number; jobPath: string; number: number | null }) {
  pendingOpen = ref
  window.dispatchEvent(new CustomEvent('devtools:jenkins-open'))
}
export function takePendingOpen() {
  const p = pendingOpen
  pendingOpen = null
  return p
}

const PATTERN_KEY = 'devtools.helm-patterns'
export function loadCustomPatterns(): PatternDef[] | null {
  try {
    const raw = localStorage.getItem(PATTERN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
export function saveCustomPatterns(p: PatternDef[] | null) {
  try {
    if (p) localStorage.setItem(PATTERN_KEY, JSON.stringify(p))
    else localStorage.removeItem(PATTERN_KEY)
  } catch {
    /* ignore */
  }
}

export function guessService(jobPath: string): string {
  const leaf = jobPath.split('/').filter(Boolean).pop() ?? jobPath
  return leaf.replace(/[-_](ci|cd|deploy|build|release|pipeline|helm)$/i, '')
}

export function guessEnv(params: { name: string; value: string }[]): string {
  const p = params.find((x) => /^(env|environment|target_env|deploy_env|stage)$/i.test(x.name))
  return p?.value?.toUpperCase() ?? ''
}
