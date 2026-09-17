import type { GitCommit } from './gitGraph'

export type ChangelogEntry = { type: string; scope: string | null; breaking: boolean; description: string; hash: string }

const TYPE_LABELS: Record<string, string> = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build',
  ci: 'CI',
  style: 'Style',
  chore: 'Chores',
  revert: 'Reverts',
}

export const TYPE_ORDER = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'style', 'chore', 'revert', 'other']

const CONVENTIONAL = /^(\w+)(\(([^)]+)\))?(!)?:\s*(.+)$/

/** Parses Conventional-Commit-style subjects (`feat(scope)!: message`) — non-matching subjects fall into "other". */
export function parseConventionalCommits(commits: GitCommit[]): ChangelogEntry[] {
  return commits.map((c) => {
    const m = CONVENTIONAL.exec(c.subject.trim())
    if (!m) return { type: 'other', scope: null, breaking: false, description: c.subject, hash: c.hash.slice(0, 7) }
    const [, rawType, , scope, bang, description] = m
    const type = TYPE_LABELS[rawType.toLowerCase()] ? rawType.toLowerCase() : 'other'
    return { type, scope: scope ?? null, breaking: bang === '!', description, hash: c.hash.slice(0, 7) }
  })
}

export function groupByType(entries: ChangelogEntry[]): { type: string; label: string; entries: ChangelogEntry[] }[] {
  const groups = new Map<string, ChangelogEntry[]>()
  for (const e of entries) {
    if (!groups.has(e.type)) groups.set(e.type, [])
    groups.get(e.type)!.push(e)
  }
  return TYPE_ORDER.filter((t) => groups.has(t)).map((t) => ({ type: t, label: TYPE_LABELS[t] ?? 'Other', entries: groups.get(t)! }))
}

/** Renders Keep-a-Changelog-style markdown, breaking changes called out first regardless of type. */
export function buildChangelogMarkdown(entries: ChangelogEntry[], heading = 'Unreleased'): string {
  const breaking = entries.filter((e) => e.breaking)
  const lines: string[] = [`## ${heading}`, '']
  if (breaking.length > 0) {
    lines.push('### ⚠ BREAKING CHANGES', '')
    for (const e of breaking) lines.push(`- ${e.scope ? `**${e.scope}:** ` : ''}${e.description} (\`${e.hash}\`)`)
    lines.push('')
  }
  for (const group of groupByType(entries)) {
    lines.push(`### ${group.label}`, '')
    for (const e of group.entries) lines.push(`- ${e.scope ? `**${e.scope}:** ` : ''}${e.description} (\`${e.hash}\`)`)
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}
