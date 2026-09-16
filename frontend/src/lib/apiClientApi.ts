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

export type ApiCollection = { id: number; name: string; createdAt: string }
export type ApiRequestDef = {
  id: number
  collectionId: number
  name: string
  method: string
  url: string
  headersJson: string | null
  body: string | null
  createdAt: string
  updatedAt: string
}
export type HeaderKV = { key: string; value: string }
export type RequestSave = { collectionId: number; name: string; method: string; url: string; headersJson: string; body: string }

export type ApiEnvironment = { id: number; collectionId: number; name: string; variablesJson: string; createdAt: string }
export type EnvironmentSave = { collectionId: number; name: string; variablesJson: string }

export type ExecuteRequest = { method: string; url: string; headers: HeaderKV[]; body: string }
export type ExecuteResponse = {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  bodyBytes: number
}

export const listCollections = () => jsonFetch<ApiCollection[]>('/api/api-client/collections', 'GET')
export const createCollection = (name: string) => jsonFetch<ApiCollection>('/api/api-client/collections', 'POST', { name })
export const deleteCollection = (id: number) => jsonFetch<void>(`/api/api-client/collections/${id}`, 'DELETE')
export const listRequests = (collectionId: number) => jsonFetch<ApiRequestDef[]>(`/api/api-client/collections/${collectionId}/requests`, 'GET')
export const saveRequest = (req: RequestSave) => jsonFetch<ApiRequestDef>('/api/api-client/requests', 'POST', req)
export const updateRequest = (id: number, req: RequestSave) => jsonFetch<ApiRequestDef>(`/api/api-client/requests/${id}`, 'PUT', req)
export const deleteRequest = (id: number) => jsonFetch<void>(`/api/api-client/requests/${id}`, 'DELETE')
export const executeRequest = (req: ExecuteRequest) => jsonFetch<ExecuteResponse>('/api/api-client/execute', 'POST', req)

export const listEnvironments = (collectionId: number) =>
  jsonFetch<ApiEnvironment[]>(`/api/api-client/collections/${collectionId}/environments`, 'GET')
export const saveEnvironment = (req: EnvironmentSave) => jsonFetch<ApiEnvironment>('/api/api-client/environments', 'POST', req)
export const updateEnvironment = (id: number, req: EnvironmentSave) =>
  jsonFetch<ApiEnvironment>(`/api/api-client/environments/${id}`, 'PUT', req)
export const deleteEnvironment = (id: number) => jsonFetch<void>(`/api/api-client/environments/${id}`, 'DELETE')
