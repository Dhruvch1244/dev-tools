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

export type SavedGitRepo = { id: number; path: string; label: string; createdAt: string }

export type CommitEntry = { hash: string; author: string; date: string; subject: string }
export type BranchEntry = { name: string; current: boolean }
export type RemoteEntry = { name: string; url: string }
export type StashEntry = { ref: string; message: string }

export type GitOverview = {
  path: string
  label: string
  branch: string
  ahead: number | null
  behind: number | null
  changedFiles: string[]
  recentCommits: CommitEntry[]
  branches: BranchEntry[]
  remotes: RemoteEntry[]
  stashes: StashEntry[]
}

export const listGitRepos = () => jsonFetch<SavedGitRepo[]>('/api/git-repos', 'GET')
export const addGitRepo = (path: string, label: string) => jsonFetch<SavedGitRepo>('/api/git-repos', 'POST', { path, label })
export const removeGitRepo = (id: number) => jsonFetch<void>(`/api/git-repos/${id}`, 'DELETE')
export const getGitOverview = (id: number) => jsonFetch<GitOverview>(`/api/git-repos/${id}/overview`, 'GET')
export const fetchGitRepo = (id: number) => jsonFetch<GitOverview>(`/api/git-repos/${id}/fetch`, 'POST')
