import { useEffect, useMemo, useState } from 'react'
import { DownloadSimple } from '@phosphor-icons/react'
import { parseGitLog } from '../lib/gitGraph'
import { buildChangelogMarkdown, groupByType, parseConventionalCommits } from '../lib/changelog'
import { exportTextAsFile } from '../lib/export'
import { Panel, SectionLabel, ErrorBanner, CopyButton, Button } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

const LOG_COMMAND = 'git log --format="%H|%P|%s|%an|%ad" --date=short'
const DRAFT_KEY = 'devtools.changelog-draft'

const SAMPLE = `a1b2c3d|d4e5f6a|feat(auth): add remember-me checkbox|Bilal|2024-02-10
d4e5f6a|f6a7b8c|fix(login): correct redirect after logout|Alice|2024-02-09
f6a7b8c|9c8d7e6|feat(api)!: rename /users to /accounts|Alice|2024-02-08
9c8d7e6|5e4d3c2|perf(search): index the lookup table|Bilal|2024-02-07
5e4d3c2|1b2a3c4|docs: update README setup steps|Alice|2024-02-05
1b2a3c4|0f1e2d3|chore: bump dependencies|Alice|2024-02-01
0f1e2d3||Initial commit|Alice|2024-01-30
`

export function ChangelogGeneratorPage() {
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY) ?? '')
  const [heading, setHeading] = useState('Unreleased')

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(DRAFT_KEY, text), 400)
    return () => clearTimeout(t)
  }, [text])

  const { entries, error } = useMemo(() => {
    if (!text.trim()) return { entries: [], error: null as string | null }
    try {
      const commits = parseGitLog(text)
      if (commits.length === 0) return { entries: [], error: 'No commits parsed — check the format matches the command above.' }
      return { entries: parseConventionalCommits(commits), error: null }
    } catch (e) {
      return { entries: [], error: e instanceof Error ? e.message : 'Could not parse log' }
    }
  }, [text])

  const groups = useMemo(() => groupByType(entries), [entries])
  const breakingCount = entries.filter((e) => e.breaking).length
  const markdown = useMemo(() => (entries.length ? buildChangelogMarkdown(entries, heading || 'Unreleased') : ''), [entries, heading])

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="changelog-generator" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3 p-4">
            <SectionLabel>Paste git log output</SectionLabel>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-glass px-2 py-1.5">
              <code className="truncate text-[10px] text-ink-soft">{LOG_COMMAND}</code>
              <CopyButton text={LOG_COMMAND} label="" />
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              placeholder={SAMPLE}
              className="h-56 resize-none rounded-2xl border border-rule bg-panel p-3 font-mono text-[11.5px] text-ink outline-none focus:border-cyan/50"
            />
            <Button variant="ghost" onClick={() => setText(SAMPLE)}>Try a sample</Button>
            <SectionLabel>Section heading</SectionLabel>
            <input
              className="devtools-input text-xs"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Unreleased, or v1.4.0 - 2026-09-17"
            />
            <div className="text-[11px] text-ink-faint">
              Groups Conventional-Commit-style subjects (<code>feat:</code>, <code>fix:</code>,
              <code> perf:</code>, …) into a Keep-a-Changelog section. Commits that don't follow
              that convention land under "Other". A <code>!</code> before the colon (e.g.{' '}
              <code>feat!:</code>) is called out as a breaking change.
            </div>
          </div>
        </Panel>
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} />
          </div>
        )}
        {!error && entries.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">Paste a git log to generate a changelog.</div>
        )}
        {entries.length > 0 && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-rule-soft px-4 py-3">
              <div className="text-[11px] text-ink-faint">
                {entries.length} commit(s) · {groups.length} type(s)
                {breakingCount > 0 && <span className="text-rose"> · {breakingCount} breaking</span>}
              </div>
              <div className="flex gap-2">
                <CopyButton text={markdown} label="Copy Markdown" />
                <Button
                  variant="default"
                  onClick={() => exportTextAsFile('CHANGELOG.md', markdown, 'markdown')}
                  className="py-1.5 text-xs"
                >
                  <DownloadSimple size={13} weight="light" /> Export .md
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink-soft">{markdown}</pre>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
