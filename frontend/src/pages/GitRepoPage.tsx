import { useEffect, useState } from 'react'
import { ArrowClockwise, ArrowsDownUp, GitBranch, Plus, Trash } from '@phosphor-icons/react'
import {
  addGitRepo,
  fetchGitRepo,
  getGitOverview,
  listGitRepos,
  removeGitRepo,
  type GitOverview,
  type SavedGitRepo,
} from '../lib/gitRepoApi'
import { Button, Panel, SectionLabel, ErrorBanner, CopyButton } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

export function GitRepoPage() {
  const [repos, setRepos] = useState<SavedGitRepo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [overview, setOverview] = useState<GitOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [addPath, setAddPath] = useState('')
  const [addLabel, setAddLabel] = useState('')

  const refreshRepos = () => listGitRepos().then((r) => {
    setRepos(r)
    if (selectedId == null && r.length > 0) setSelectedId(r[0].id)
  })
  useEffect(() => { refreshRepos() }, [])

  useEffect(() => {
    if (selectedId == null) { setOverview(null); return }
    setLoading(true)
    setError(null)
    getGitOverview(selectedId)
      .then(setOverview)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedId])

  async function addRepo() {
    if (!addPath.trim()) return
    setError(null)
    try {
      const repo = await addGitRepo(addPath.trim(), addLabel.trim())
      setAddPath('')
      setAddLabel('')
      await refreshRepos()
      setSelectedId(repo.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add repo')
    }
  }

  async function removeRepo(id: number) {
    if (!window.confirm('Remove this repo from the list? (Does not touch anything on disk.)')) return
    await removeGitRepo(id)
    if (selectedId === id) setSelectedId(null)
    refreshRepos()
  }

  async function doFetch() {
    if (selectedId == null) return
    setLoading(true)
    setError(null)
    try {
      setOverview(await fetchGitRepo(selectedId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="git-repo" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-2 p-4">
            <SectionLabel>Add a repo</SectionLabel>
            <input
              className="devtools-input font-mono text-xs"
              placeholder="C:\code\my-project"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
            />
            <input
              className="devtools-input text-xs"
              placeholder="Label (optional)"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRepo()}
            />
            <Button variant="primary" onClick={addRepo} disabled={!addPath.trim()}>
              <Plus size={14} weight="bold" /> Add
            </Button>
            <div className="text-[10.5px] text-ink-faint">Read-only overview + fetch only. Never commits or pushes.</div>
          </div>
        </Panel>

        <Panel className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-1 overflow-auto p-3">
            <SectionLabel>Saved repos</SectionLabel>
            {repos.length === 0 && <div className="px-2 py-1 text-xs text-ink-faint">No repos added yet.</div>}
            {repos.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs ${
                  selectedId === r.id ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'
                }`}
              >
                <GitBranch size={13} weight="light" className="shrink-0" />
                <span className="flex-1 truncate">{r.label}</span>
                <Trash
                  size={12}
                  weight="light"
                  className="shrink-0 opacity-0 transition-opacity hover:text-rose group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); removeRepo(r.id) }}
                />
              </button>
            ))}
          </div>
        </Panel>
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
          {error && <ErrorBanner message={error} />}

          {!overview && !error && (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">
              {selectedId == null ? 'Add or select a repo on the left.' : loading ? 'Loading…' : 'No data.'}
            </div>
          )}

          {overview && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{overview.label}</div>
                  <div className="truncate font-mono text-[10.5px] text-ink-faint">{overview.path}</div>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-glass-strong px-2.5 py-1 text-[11px] text-cyan">
                  <GitBranch size={12} weight="light" /> {overview.branch}
                </span>
                {(overview.ahead != null || overview.behind != null) && (
                  <span className="flex items-center gap-1 rounded-full bg-glass px-2.5 py-1 text-[11px] text-ink-soft">
                    <ArrowsDownUp size={12} weight="light" />
                    {overview.ahead ? `↑${overview.ahead} ` : ''}{overview.behind ? `↓${overview.behind}` : ''}
                    {!overview.ahead && !overview.behind ? 'up to date' : ''}
                  </span>
                )}
                <Button variant="default" onClick={doFetch} disabled={loading}>
                  <ArrowClockwise size={13} weight="light" /> Fetch
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Panel className="flex flex-col overflow-hidden">
                  <div className="flex max-h-64 flex-col gap-1 overflow-auto p-3">
                    <SectionLabel>Uncommitted changes ({overview.changedFiles.length})</SectionLabel>
                    {overview.changedFiles.length === 0 ? (
                      <div className="text-xs text-ink-faint">Clean working tree.</div>
                    ) : (
                      overview.changedFiles.map((f, i) => (
                        <div key={i} className="truncate rounded bg-glass px-2 py-1 font-mono text-[11px] text-ink-soft">{f}</div>
                      ))
                    )}
                  </div>
                </Panel>

                <Panel className="flex flex-col overflow-hidden">
                  <div className="flex max-h-64 flex-col gap-1 overflow-auto p-3">
                    <SectionLabel>Remotes</SectionLabel>
                    {overview.remotes.length === 0 ? (
                      <div className="text-xs text-ink-faint">No remotes configured.</div>
                    ) : (
                      overview.remotes.map((r, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 rounded bg-glass px-2 py-1 text-[11px]">
                          <span className="shrink-0 font-medium text-ink-soft">{r.name}</span>
                          <span className="truncate font-mono text-ink-faint">{r.url}</span>
                        </div>
                      ))
                    )}
                    {overview.stashes.length > 0 && (
                      <>
                        <SectionLabel>Stash</SectionLabel>
                        {overview.stashes.map((s, i) => (
                          <div key={i} className="truncate rounded bg-glass px-2 py-1 text-[11px] text-ink-soft">
                            <span className="font-mono text-ink-faint">{s.ref}</span> {s.message}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </Panel>
              </div>

              <Panel className="flex flex-col overflow-hidden">
                <div className="flex max-h-48 flex-col gap-1 overflow-auto p-3">
                  <SectionLabel>Branches ({overview.branches.length})</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {overview.branches.map((b, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-2.5 py-1 text-[11px] ${b.current ? 'bg-glass-strong text-cyan' : 'bg-glass text-ink-soft'}`}
                      >
                        {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel className="flex flex-1 flex-col overflow-hidden">
                <div className="flex flex-1 flex-col gap-1 overflow-auto p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <SectionLabel>Recent commits</SectionLabel>
                    <CopyButton text={overview.recentCommits.map((c) => `${c.hash.slice(0, 7)} ${c.subject}`).join('\n')} />
                  </div>
                  {overview.recentCommits.map((c) => (
                    <div key={c.hash} className="flex items-center gap-3 border-l-2 border-rule-soft py-1 pl-3 text-xs">
                      <span className="font-mono text-[10.5px] text-ink-faint">{c.hash.slice(0, 7)}</span>
                      <span className="flex-1 truncate text-ink">{c.subject}</span>
                      <span className="shrink-0 text-[10.5px] text-ink-faint">{c.author}</span>
                      <span className="shrink-0 text-[10.5px] text-ink-faint">{c.date}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}
