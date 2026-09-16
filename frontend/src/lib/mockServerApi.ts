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
}

export const listMockRoutes = () => jsonFetch<MockRoute[]>('/api/mock-routes', 'GET')
export const createMockRoute = (req: MockRouteSave) => jsonFetch<MockRoute>('/api/mock-routes', 'POST', req)
export const updateMockRoute = (id: number, req: MockRouteSave) => jsonFetch<MockRoute>(`/api/mock-routes/${id}`, 'PUT', req)
export const deleteMockRoute = (id: number) => jsonFetch<void>(`/api/mock-routes/${id}`, 'DELETE')
