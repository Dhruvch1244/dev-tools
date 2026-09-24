async function jsonFetch<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Request failed')
  const text = await res.text()
  return text ? JSON.parse(text) : (undefined as T)
}

export type BeanKind = 'RestController' | 'Controller' | 'Service' | 'Repository' | 'Component' | 'Configuration' | 'RemoteClient' | 'ExternalService' | 'Bean'

export type SpringVizNode = {
  id: string
  simpleName: string
  packageName: string
  kind: BeanKind
  endpointCount: number
  module: string
  project: string
  file: string | null
  line: number | null
  lineCount: number
  methodCount: number
  fanIn: number
  fanOut: number
  injection: 'none' | 'constructor' | 'field' | 'setter' | 'mixed'
  annotations: string[]
  profiles: string[]
}
export type SpringVizEdge = { from: string; to: string; kind: 'injects' | 'produces' | 'calls' }
export type SpringVizParam = { name: string; source: string; type: string; required: boolean; defaultValue: string | null }
export type SpringVizEndpoint = {
  httpMethod: string
  path: string
  controllerClass: string
  methodName: string
  project: string
  params: SpringVizParam[]
  returnType: string
  consumes: string[]
  produces: string[]
  security: string[]
  deprecated: boolean
  file: string | null
  line: number | null
}
export type SpringVizCycle = { path: string[] }
export type SpringVizEntryPoint = { kind: string; className: string; methodName: string; detail: string; project: string; file: string | null; line: number | null }
export type SpringVizRelation = { field: string; kind: string; target: string | null; eager: boolean }
export type SpringVizEntity = {
  name: string
  packageName: string
  table: string | null
  idType: string | null
  fieldCount: number
  relations: SpringVizRelation[]
  repositories: string[]
  project: string
  file: string | null
  line: number | null
}
export type SpringVizFinding = {
  severity: 'high' | 'medium' | 'low' | 'info'
  category: string
  title: string
  detail: string
  className: string | null
  methodName: string | null
  file: string | null
  line: number | null
}
export type SpringVizConfigKey = { key: string; defaultValue: string | null; defined: boolean; usedIn: string[]; definedIn: string[] }
export type SpringVizParseError = { file: string; message: string }
export type SpringVizStats = {
  javaFiles: number
  testFiles: number
  classes: number
  interfaces: number
  beans: number
  endpoints: number
  entities: number
  linesOfCode: number
  configFiles: number
  parseErrors: SpringVizParseError[]
}

export type SpringVizResponse = {
  nodes: SpringVizNode[]
  edges: SpringVizEdge[]
  endpoints: SpringVizEndpoint[]
  contextPath: string | null
  port: number | null
  javaFilesScanned: number
  workspace: boolean
  projects: string[]
  cycles: SpringVizCycle[]
  entryPoints: SpringVizEntryPoint[]
  entities: SpringVizEntity[]
  findings: SpringVizFinding[]
  configKeys: SpringVizConfigKey[]
  profiles: string[]
  stats: SpringVizStats
}

export const analyzeSpringRepo = (path: string) =>
  jsonFetch<SpringVizResponse>('/api/springviz/analyze', 'POST', { path })
