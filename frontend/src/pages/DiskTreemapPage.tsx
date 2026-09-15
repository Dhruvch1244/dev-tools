import { useMemo, useState } from 'react'
import { ArrowLeft, ChartBar, ChartPie, File as FileIcon, Folder, SquaresFour } from '@phosphor-icons/react'
import { scanDisk, type DiskNode } from '../lib/diskVizApi'
import { squarify } from '../lib/treemap'
import { Panel, SectionLabel, ErrorBanner, Button } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

const COLORS = ['var(--cyan)', 'var(--violet)', 'var(--emerald)', 'var(--warm)', 'var(--rose)']
const NOISE_NAME = new Set([
  'node_modules', '.git', 'dist', 'build', 'target', 'out', 'bin', 'obj',
  '.next', '.turbo', '.gradle', '.idea', '.vscode', '__pycache__', '.venv', 'venv', 'coverage',
])
const NOISE_GREY = 'var(--ink-faint)'

function isNoise(node: DiskNode): boolean {
  return node.directory && NOISE_NAME.has(node.name.toLowerCase())
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = -1
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < units.length - 1)
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`
}

export function DiskTreemapPage() {
  const [pathInput, setPathInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [root, setRoot] = useState<DiskNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState<DiskNode | null>(null)
  const [view, setView] = useState<'treemap' | 'pie'>('treemap')

  async function scan(path: string, pushHistory: boolean) {
    if (!path.trim()) return
    setLoading(true)
    setError(null)
    try {
      const node = await scanDisk(path.trim(), 2)
      if (pushHistory && root) setHistory((h) => [...h, root.path])
      setRoot(node)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  function goBack() {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    scan(prev, false)
  }

  const rects = useMemo(() => {
    if (!root || root.children.length === 0) return []
    return squarify(root.children.map((c) => ({ size: c.sizeBytes, item: { node: c } })), 0, 0, 1000, 560)
  }, [root])

  const pieSlices = useMemo(() => {
    if (!root || root.children.length === 0) return []
    const total = root.children.reduce((a, c) => a + Math.max(0, c.sizeBytes), 0)
    if (total <= 0) return []
    let angle = -Math.PI / 2
    const cx = 280
    const cy = 280
    const r = 220
    return root.children
      .filter((c) => c.sizeBytes > 0)
      .map((node) => {
        const frac = node.sizeBytes / total
        const start = angle
        const end = angle + frac * Math.PI * 2
        angle = end
        const large = end - start > Math.PI ? 1 : 0
        const x1 = cx + r * Math.cos(start)
        const y1 = cy + r * Math.sin(start)
        const x2 = cx + r * Math.cos(end)
        const y2 = cy + r * Math.sin(end)
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
        const midAngle = (start + end) / 2
        const labelX = cx + (r + 20) * Math.cos(midAngle)
        const labelY = cy + (r + 20) * Math.sin(midAngle)
        return { node, path, frac, labelX, labelY }
      })
  }, [root])

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="disk-treemap" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3 p-4">
            <SectionLabel>Folder to scan</SectionLabel>
            <input
              className="devtools-input font-mono text-xs"
              placeholder="C:\code\my-project"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scan(pathInput, false)}
            />
            <Button variant="primary" onClick={() => scan(pathInput, false)} disabled={!pathInput.trim() || loading}>
              {loading ? 'Scanning…' : 'Scan'}
            </Button>
            {history.length > 0 && (
              <Button variant="default" onClick={goBack}>
                <ArrowLeft size={14} weight="light" /> Back
              </Button>
            )}
            <div className="text-[11px] text-ink-faint">Click a box to drill into that folder. Runs entirely locally off disk.</div>
            {root && (
              <div className="rounded-xl border border-rule-soft bg-glass p-2.5 text-[11px] text-ink-soft">
                <div className="truncate font-mono text-ink">{root.path}</div>
                <div className="mt-1 text-ink-faint">
                  {formatSize(root.sizeBytes)} · {root.childCount} item{root.childCount === 1 ? '' : 's'}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} />
          </div>
        )}
        {!error && !root && (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            <div className="flex flex-col items-center gap-2">
              <ChartBar size={28} weight="light" />
              Pick a folder and scan it to see where the space went.
            </div>
          </div>
        )}
        {!error && root && (
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            <div className="mb-2 flex h-5 shrink-0 items-center justify-between text-[11px] text-ink-faint">
              {hovered ? (
                <>
                  <span className="truncate font-mono text-ink-soft">{hovered.name}</span>
                  <span className="ml-2 shrink-0">{formatSize(hovered.sizeBytes)}</span>
                </>
              ) : (
                <span>Hover a box for details</span>
              )}
              <div className="flex shrink-0 gap-1 rounded-lg border border-rule bg-panel p-0.5">
                <button
                  onClick={() => setView('treemap')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors ${view === 'treemap' ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
                >
                  <SquaresFour size={12} weight="light" /> Treemap
                </button>
                <button
                  onClick={() => setView('pie')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors ${view === 'pie' ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
                >
                  <ChartPie size={12} weight="light" /> Pie
                </button>
              </div>
            </div>

            {view === 'treemap' ? (
              <div className="relative flex-1 overflow-hidden rounded-2xl border border-rule">
                <svg viewBox="0 0 1000 560" className="h-full w-full" preserveAspectRatio="none">
                  {rects.map((r, i) => {
                    const noise = isNoise(r.node)
                    return (
                      <g key={r.node.path}>
                        <rect
                          x={r.x}
                          y={r.y}
                          width={Math.max(0, r.w - 1.5)}
                          height={Math.max(0, r.h - 1.5)}
                          fill={noise ? NOISE_GREY : COLORS[i % COLORS.length]}
                          opacity={noise ? (r.node.directory ? 0.25 : 0.15) : r.node.directory ? 0.5 : 0.28}
                          stroke="var(--surface)"
                          strokeWidth={1.5}
                          className={r.node.directory ? 'cursor-pointer' : ''}
                          onMouseEnter={() => setHovered(r.node)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => r.node.directory && scan(r.node.path, true)}
                        />
                      </g>
                    )
                  })}
                </svg>
                <div className="pointer-events-none absolute inset-0">
                  {rects
                    .filter((r) => r.w > 46 && r.h > 24)
                    .map((r) => (
                      <div
                        key={r.node.path}
                        className={`absolute flex items-center gap-1 overflow-hidden px-1.5 py-1 text-[10.5px] ${isNoise(r.node) ? 'text-ink-faint' : 'text-ink'}`}
                        style={{ left: `${(r.x / 1000) * 100}%`, top: `${(r.y / 560) * 100}%`, width: `${(r.w / 1000) * 100}%`, height: `${(r.h / 560) * 100}%` }}
                      >
                        {r.node.directory ? <Folder size={11} weight="fill" className="shrink-0 opacity-70" /> : <FileIcon size={11} weight="light" className="shrink-0 opacity-70" />}
                        <span className="truncate">{r.node.name}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="relative flex-1 overflow-auto rounded-2xl border border-rule">
                <svg viewBox="0 0 560 560" className="mx-auto h-full max-w-full">
                  {pieSlices.map((s, i) => {
                    const noise = isNoise(s.node)
                    return (
                      <path
                        key={s.node.path}
                        d={s.path}
                        fill={noise ? NOISE_GREY : COLORS[i % COLORS.length]}
                        opacity={noise ? 0.25 : 0.85}
                        stroke="var(--surface)"
                        strokeWidth={1.5}
                        className={s.node.directory ? 'cursor-pointer' : ''}
                        onMouseEnter={() => setHovered(s.node)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => s.node.directory && scan(s.node.path, true)}
                      />
                    )
                  })}
                </svg>
                <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-wrap justify-center gap-x-3 gap-y-1 px-3 text-[10.5px] text-ink-soft">
                  {pieSlices.map((s, i) => (
                    <span key={s.node.path} className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: isNoise(s.node) ? NOISE_GREY : COLORS[i % COLORS.length] }}
                      />
                      <span className={`truncate ${isNoise(s.node) ? 'text-ink-faint' : ''}`}>{s.node.name}</span>
                      <span className="text-ink-faint">{(s.frac * 100).toFixed(0)}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
