import { useMemo, useState } from 'react'
import { MagnifyingGlass, Star } from '@phosphor-icons/react'
import { GROUPS, type Tool, type ToolDef } from '../App'
import { SectionLabel } from '../components/ui'

export function HomePage({
  favourites,
  recents,
  onOpenTool,
}: {
  favourites: Tool[]
  recents: Tool[]
  onOpenTool: (id: Tool) => void
}) {
  const [query, setQuery] = useState('')

  const allTools = useMemo(() => GROUPS.flatMap((g) => g.tools), [])
  const toolDefs = useMemo(() => new Map(allTools.map((t) => [t.id, t])), [allTools])

  const favouriteDefs = favourites.map((id) => toolDefs.get(id)).filter((t): t is ToolDef => !!t)
  const recentDefs = recents
    .map((id) => toolDefs.get(id))
    .filter((t): t is ToolDef => !!t && !favourites.includes(t.id))
    .slice(0, 8)

  const q = query.trim().toLowerCase()
  const matches = (t: ToolDef) => !q || t.label.toLowerCase().includes(q) || t.hint.toLowerCase().includes(q)
  const filteredGroups = GROUPS.filter((g) => g.label !== 'Home')
    .map((g) => ({ ...g, tools: g.tools.filter(matches) }))
    .filter((g) => g.tools.length > 0)

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto pb-4">
      <div>
        <div className="mb-1 text-lg font-semibold text-ink">Dev Tools</div>
        <div className="text-sm text-ink-faint">33 tools, all local, all offline. Pick one below or search.</div>
      </div>

      <div className="relative max-w-md">
        <MagnifyingGlass size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all tools…"
          className="devtools-input pl-9"
        />
      </div>

      {!q && favouriteDefs.length > 0 && (
        <section>
          <SectionLabel>Favourites</SectionLabel>
          <ToolGrid tools={favouriteDefs} onOpenTool={onOpenTool} favourites={favourites} />
        </section>
      )}

      {!q && recentDefs.length > 0 && (
        <section>
          <SectionLabel>Recently used</SectionLabel>
          <ToolGrid tools={recentDefs} onOpenTool={onOpenTool} favourites={favourites} />
        </section>
      )}

      <section className="flex flex-1 flex-col gap-4">
        {q && <SectionLabel>Search results</SectionLabel>}
        {q && filteredGroups.length === 0 && <div className="text-sm text-ink-faint">No tools match "{query.trim()}"</div>}
        {filteredGroups.map((group) => (
          <div key={group.label}>
            {!q && <SectionLabel>{group.label}</SectionLabel>}
            <ToolGrid tools={group.tools} onOpenTool={onOpenTool} favourites={favourites} />
          </div>
        ))}
      </section>
    </div>
  )
}

function ToolGrid({ tools, onOpenTool, favourites }: { tools: ToolDef[]; onOpenTool: (id: Tool) => void; favourites: Tool[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
      {tools.map((t) => {
        const Icon = t.icon
        const isFav = favourites.includes(t.id)
        return (
          <button
            key={t.id}
            onClick={() => onOpenTool(t.id)}
            className="group flex items-start gap-2.5 rounded-2xl border border-rule-soft bg-glass p-3 text-left transition-colors hover:border-rule hover:bg-glass-strong"
          >
            <Icon size={18} weight="light" className="mt-0.5 shrink-0 text-cyan" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-ink">{t.label}</span>
                {isFav && <Star size={10} weight="fill" className="shrink-0 text-warm" />}
              </div>
              <div className="truncate text-[10.5px] text-ink-faint">{t.hint}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
