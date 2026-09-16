import { useEffect, useMemo, useState } from 'react'
import { ArrowClockwise, ArrowsDownUp, GitBranch, ListBullets, Plus, ShareNetwork, Star, Trash } from '@phosphor-icons/react'
import {
  addGitRepo,
  fetchGitRepo,
  getGitOverview,
  listGitRepos,
  removeGitRepo,
  type GitOverview,
  type SavedGitRepo,
} from '../lib/gitRepoApi'
import { layoutCommits, type PositionedCommit } from '../lib/gitGraph'
import { Button, Panel, SectionLabel, ErrorBanner, CopyButton } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

const LANE_COLORS = ['var(--cyan)', 'var(--violet)', 'var(--emerald)', 'var(--warm)', 'var(--rose)']
const ROW_H = 26
const LANE_W = 16
const DOT_R = 4

const FAV_BRANCHES_KEY = 'devtools.git-repo-fav-branches'

function loadFavBranches(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(FAV_BRANCHES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function saveFavBranches(all: Record<string, string[]>) {
  try {
    localStorage.setItem(FAV_BRANCHES_KEY, JSON.stringify(all))
  } catch {
    /* storage full or unavailable */
  }
}

export function GitRepoPage() {
  const [repos, setRepos] = useState<SavedGitRepo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [overview, setOverview] = useState<GitOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [addPath, setAddPath] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [showAllBranches, setShowAllBranches] = useState(false)
  const [branchFilter, setBranchFilter] = useState('')
  const [favBranchesByRepo, setFavBranchesByRepo] = useState<Record<string, string[]>>(() => loadFavBranches())
  const [commitView, setCommitView] = useState<'list' | 'graph'>('list')

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

  const favBranches = overview ? new Set(favBranchesByRepo[overview.path] ?? []) : new Set<string>()

  function toggleFavBranch(name: string) {
    if (!overview) return
    const current = new Set(favBranchesByRepo[overview.path] ?? [])
    current.has(name) ? current.delete(name) : current.add(name)
    const next = { ...favBranchesByRepo, [overview.path]: Array.from(current) }
    setFavBranchesByRepo(next)
    saveFavBranches(next)
  }

  const visibleBranches = useMemo(() => {
    if (!overview) return []
    if (branchFilter.trim()) {
      const q = branchFilter.trim().toLowerCase()
      return overview.branches.filter((b) => b.name.toLowerCase().includes(q))
    }
    if (showAllBranches) return overview.branches
    const isMain = (n: string) => n === 'main' || n === 'master' || n.endsWith('/main') || n.endsWith('/master')
    return overview.branches.filter((b) => b.current || isMain(b.name) || favBranches.has(b.name))
  }, [overview, branchFilter, showAllBranches, favBranches])

  const commitGraph = useMemo(() => {
    if (!overview) return null
    const commits: PositionedCommit[] = layoutCommits(overview.recentCommits).positioned
    const laneCount = Math.max(1, ...commits.map((c) => c.lane + 1))
    return { commits, laneCount }
  }, [overview])

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
                  <div className="flex flex-col gap-1 p-3">
                    <SectionLabel>Uncommitted changes ({overview.changedFiles.length})</SectionLabel>
                    <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pr-1">
                      {overview.changedFiles.length === 0 ? (
                        <div className="text-xs text-ink-faint">Clean working tree.</div>
                      ) : (
                        overview.changedFiles.map((f, i) => {
                          const status = f.slice(0, 2).trim() || '?'
                          const path = f.slice(2).trim()
                          const color =
                            status.includes('?') ? 'text-ink-faint' :
                            status.includes('D') ? 'text-rose' :
                            status.includes('A') ? 'text-emerald' :
                            'text-warm'
                          return (
                            <div key={i} title={f} className="flex items-center gap-2 rounded bg-glass px-2 py-1 text-[11px]">
                              <span className={`w-6 shrink-0 font-mono font-semibold ${color}`}>{status}</span>
                              <span className="min-w-0 flex-1 truncate font-mono text-ink-soft">{path}</span>
                            </div>
                          )
                        })
                      )}
                    </div>
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
                <div className="flex flex-col gap-1.5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel>
                      Branches ({overview.branches.length}){!showAllBranches && !branchFilter.trim() ? ' — main + favourites' : ''}
                    </SectionLabel>
                    <div className="flex items-center gap-2">
                      {overview.branches.length > 8 && (
                        <input
                          className="devtools-input h-6 w-32 py-0 text-[10.5px]"
                          placeholder="Filter branches…"
                          value={branchFilter}
                          onChange={(e) => setBranchFilter(e.target.value)}
                        />
                      )}
                      {overview.branches.length > 8 && !branchFilter.trim() && (
                        <button onClick={() => setShowAllBranches((v) => !v)} className="text-[10.5px] text-cyan hover:underline">
                          {showAllBranches ? 'Show less' : `Show all ${overview.branches.length}`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex max-h-48 flex-wrap gap-1.5 overflow-auto">
                    {visibleBranches.map((b, i) => (
                      <span
                        key={i}
                        className={`group flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${b.current ? 'bg-glass-strong text-cyan' : 'bg-glass text-ink-soft'}`}
                      >
                        {b.name}
                        <Star
                          size={10}
                          weight={favBranches.has(b.name) ? 'fill' : 'light'}
                          onClick={() => toggleFavBranch(b.name)}
                          className={`cursor-pointer ${favBranches.has(b.name) ? 'text-warm' : 'text-ink-faint opacity-0 group-hover:opacity-100'}`}
                        />
                      </span>
                    ))}
                    {visibleBranches.length === 0 && <div className="text-xs text-ink-faint">No branches match.</div>}
                  </div>
                </div>
              </Panel>

              <Panel className="flex flex-1 flex-col overflow-hidden">
                <div className="flex flex-1 flex-col gap-1 overflow-auto p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <SectionLabel>Recent commits</SectionLabel>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5 rounded-lg border border-rule bg-panel p-0.5">
                        <button
                          onClick={() => setCommitView('list')}
                          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium ${commitView === 'list' ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
                        >
                          <ListBullets size={12} weight="light" /> List
                        </button>
                        <button
                          onClick={() => setCommitView('graph')}
                          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium ${commitView === 'graph' ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
                        >
                          <ShareNetwork size={12} weight="light" /> Graph
                        </button>
                      </div>
                      <CopyButton text={overview.recentCommits.map((c) => `${c.hash.slice(0, 7)} ${c.subject}`).join('\n')} />
                    </div>
                  </div>

                  {commitView === 'list' ? (
                    overview.recentCommits.map((c) => (
                      <div key={c.hash} className="flex items-center gap-3 border-l-2 border-rule-soft py-1 pl-3 text-xs">
                        <span className="font-mono text-[10.5px] text-ink-faint">{c.hash.slice(0, 7)}</span>
                        <span className="flex-1 truncate text-ink">{c.subject}</span>
                        <span className="shrink-0 text-[10.5px] text-ink-faint">{c.author}</span>
                        <span className="shrink-0 text-[10.5px] text-ink-faint">{c.date}</span>
                      </div>
                    ))
                  ) : commitGraph && commitGraph.commits.length > 0 ? (
                    <div className="flex overflow-auto">
                      <svg
                        width={commitGraph.laneCount * LANE_W + 20}
                        height={commitGraph.commits.length * ROW_H + 20}
                        className="shrink-0"
                      >
                        {commitGraph.commits.map((c) =>
                          c.parents.map((parentHash) => {
                            const parent = commitGraph.commits.find((p) => p.hash === parentHash)
                            if (!parent) return null
                            const x1 = c.lane * LANE_W + 12
                            const y1 = c.row * ROW_H + 13
                            const x2 = parent.lane * LANE_W + 12
                            const y2 = parent.row * ROW_H + 13
                            const color = LANE_COLORS[c.lane % LANE_COLORS.length]
                            if (x1 === x2) return <line key={`${c.hash}-${parentHash}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} />
                            const midY = (y1 + y2) / 2
                            return (
                              <path
                                key={`${c.hash}-${parentHash}`}
                                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                                fill="none"
                                stroke={color}
                                strokeWidth={2}
                              />
                            )
                          })
                        )}
                        {commitGraph.commits.map((c) => (
                          <circle key={c.hash} cx={c.lane * LANE_W + 12} cy={c.row * ROW_H + 13} r={DOT_R} fill={LANE_COLORS[c.lane % LANE_COLORS.length]} />
                        ))}
                      </svg>
                      <div className="flex-1">
                        {commitGraph.commits.map((c) => (
                          <div key={c.hash} className="flex items-center gap-3 pr-2 text-xs" style={{ height: ROW_H }}>
                            <span className="font-mono text-[10.5px] text-ink-faint">{c.hash.slice(0, 7)}</span>
                            <span className="flex-1 truncate text-ink">{c.subject}</span>
                            <span className="shrink-0 text-[10.5px] text-ink-faint">{c.author}</span>
                            <span className="shrink-0 text-[10.5px] text-ink-faint">{c.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-ink-faint">No commits to graph.</div>
                  )}
                </div>
              </Panel>
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}
