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

export type VaultEntry = {
  id: number
  environment: string
  name: string
  url: string | null
  username: string | null
  secret: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type VaultRequest = {
  environment: string
  name: string
  url: string | null
  username: string | null
  secret: string
  notes: string | null
}

export const listVaultEntries = () => jsonFetch<VaultEntry[]>('/api/vault', 'GET')
export const createVaultEntry = (req: VaultRequest) => jsonFetch<VaultEntry>('/api/vault', 'POST', req)
export const updateVaultEntry = (id: number, req: VaultRequest) => jsonFetch<VaultEntry>(`/api/vault/${id}`, 'PUT', req)
export const deleteVaultEntry = (id: number) => jsonFetch<void>(`/api/vault/${id}`, 'DELETE')
