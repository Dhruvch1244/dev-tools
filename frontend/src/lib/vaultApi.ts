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
  secret: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  locked: boolean
}

export type EncryptionStatus = { enabled: boolean; unlocked: boolean }

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

export const getEncryptionStatus = () => jsonFetch<EncryptionStatus>('/api/vault/encryption/status', 'GET')
export const enableEncryption = (passphrase: string) =>
  jsonFetch<EncryptionStatus>('/api/vault/encryption/enable', 'POST', { passphrase })
export const disableEncryption = (passphrase: string) =>
  jsonFetch<EncryptionStatus>('/api/vault/encryption/disable', 'POST', { passphrase })
export const unlockVault = (passphrase: string) =>
  jsonFetch<{ unlocked: boolean }>('/api/vault/encryption/unlock', 'POST', { passphrase })
export const lockVault = () => jsonFetch<EncryptionStatus>('/api/vault/encryption/lock', 'POST')
export const rotatePassphrase = (oldPassphrase: string, newPassphrase: string) =>
  jsonFetch<EncryptionStatus>('/api/vault/encryption/rotate', 'POST', { oldPassphrase, newPassphrase })
