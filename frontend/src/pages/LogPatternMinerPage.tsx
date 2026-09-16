import { useState } from 'react'
import { ChartBar } from '@phosphor-icons/react'
import { mineLogPatterns, type MineResult } from '../lib/logToolsApi'
import { Button, Panel, SectionLabel, ErrorBanner, CopyButton } from '../components/ui'

export function LogPatternMinerPage() {
  const [path, setPath] = useState('')
  const [result, setResult] = useState<MineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!path.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResult(await mineLogPatterns(path.trim()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const maxCount = result?.templates[0]?.count ?? 1

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel>
        <div className="flex flex-col gap-2 p-4">
          <SectionLabel>Log file to mine</SectionLabel>
          <div className="flex items-center gap-2">
            <input
              className="devtools-input flex-1 font-mono text-xs"
              placeholder="C:\logs\app.log"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
            <Button variant="primary" onClick={run} disabled={!path.trim() || loading}>
              <ChartBar size={14} weight="light" /> {loading ? 'Mining…' : 'Mine patterns'}
            </Button>
          </div>
          <div className="text-[10.5px] text-ink-faint">
            Replaces numbers, hex, UUIDs, and quoted strings with placeholders, then groups lines by the resulting
            template — turns thousands of near-duplicate lines into the handful of distinct things that actually happened.
          </div>
          {result && (
            <div className="rounded-xl border border-rule-soft bg-glass p-2.5 text-[11px] text-ink-soft">
              {result.linesScanned.toLocaleString()} lines scanned · {result.templates.length} distinct patterns
            </div>
          )}
        </div>
      </Panel>

      {error && <ErrorBanner message={error} />}

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-3">
          {!result ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">Patterns appear here, most frequent first.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {result.templates.map((t, i) => (
                <div key={i} className="rounded-xl border border-rule-soft bg-glass px-3 py-2.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-glass-strong px-2 py-0.5 text-[10.5px] font-medium text-cyan">{t.count.toLocaleString()}×</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-glass-strong">
                      <div className="h-full rounded-full bg-cyan/60" style={{ width: `${Math.max(3, (t.count / maxCount) * 100)}%` }} />
                    </div>
                    <CopyButton text={t.template} label="" />
                  </div>
                  <div className="truncate font-mono text-[12px] text-ink" title={t.template}>{t.template}</div>
                  <div className="mt-0.5 truncate font-mono text-[10.5px] text-ink-faint" title={t.example}>e.g. {t.example}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
