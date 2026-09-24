async function jsonFetch<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Request failed')
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return text ? JSON.parse(text) : (undefined as T)
}

export type MockRoute = {
  id: number
  method: string
  path: string
  status: number
  responseBody: string | null
  contentType: string
  delayMs: number
  enabled: boolean
  headersJson: string | null
  templated: boolean
  createdAt: string
}

export type MockRouteSave = {
  method: string
  path: string
  status: number
  responseBody: string
  contentType: string
  delayMs: number
  enabled: boolean
  headersJson: string
  templated: boolean
}

export type MockLogEntry = {
  seq: number
  at: string
  method: string
  path: string
  query: string | null
  remoteAddr: string
  userAgent: string | null
  origin: string | null
  routeId: number | null
  status: number
  durationMs: number
  requestBody: string | null
}

export type MockNetworkAddress = { interfaceName: string; displayName: string; address: string; baseUrl: string }
export type MockNetworkInfo = { port: number; hostname: string | null; addresses: MockNetworkAddress[] }

export const listMockRoutes = () => jsonFetch<MockRoute[]>('/api/mock-routes', 'GET')
export const createMockRoute = (req: MockRouteSave) => jsonFetch<MockRoute>('/api/mock-routes', 'POST', req)
export const updateMockRoute = (id: number, req: MockRouteSave) => jsonFetch<MockRoute>(`/api/mock-routes/${id}`, 'PUT', req)
export const deleteMockRoute = (id: number) => jsonFetch<void>(`/api/mock-routes/${id}`, 'DELETE')
export const importMockRoutes = (routes: MockRouteSave[], replace: boolean) =>
  jsonFetch<{ imported: number }>('/api/mock-routes/import', 'POST', { routes, replace })
export const getMockLog = (after: number) => jsonFetch<MockLogEntry[]>(`/api/mock-routes/log?after=${after}`, 'GET')
export const clearMockLog = () => jsonFetch<void>('/api/mock-routes/log', 'DELETE')
export const getMockNetwork = () => jsonFetch<MockNetworkInfo>('/api/mock-routes/network', 'GET')

export function toSave(r: MockRoute): MockRouteSave {
  return {
    method: r.method,
    path: r.path,
    status: r.status,
    responseBody: r.responseBody ?? '',
    contentType: r.contentType,
    delayMs: r.delayMs,
    enabled: r.enabled,
    headersJson: r.headersJson ?? '',
    templated: r.templated,
  }
}
