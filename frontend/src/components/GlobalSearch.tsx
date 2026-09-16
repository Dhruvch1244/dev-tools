import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { globalSearch, type GlobalSearchResult } from '../lib/searchApi'

const TOOL_LABEL: Record<string, string> = {
  notes: 'Notes',
  'task-list': 'Task List',
  vault: 'Vault',
  'command-templates': 'Command Templates',
  'api-client': 'API Client',
}

/**
 * Content search across every tool's stored data (notes, tasks, vault entry metadata, command
 * templates, API Client collections/requests) — distinct from CommandPalette (Ctrl/Cmd+K), which
 * only jumps between tools by name. Opened with Ctrl/Cmd+Shift+F from anywhere in the app.
 */
export function GlobalSearch({ onOpenTool }: { onOpenTool: (tool: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f'
      if (isShortcut) {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const handle = setTimeout(() => {
      globalSearch(query).then(setResults).finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(handle)
  }, [query])

  function select(r: GlobalSearchResult) {
    onOpenTool(r.tool)
    setOpen(false)
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[activeIndex]) select(results[activeIndex])
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Search across all tool data (Ctrl Shift F)"
        className="flex items-center gap-2 rounded-xl border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink-faint transition-colors hover:border-cyan/40 hover:text-ink-soft"
      >
        <MagnifyingGlass size={13} weight="light" />
        <kbd className="rounded bg-glass-strong px-1 py-0.5 font-mono text-[9.5px]">⌃⇧F</kbd>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-6 pt-[12vh]"
              onClick={() => setOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[28rem] w-full max-w-xl flex-col overflow-hidden rounded-[1.5rem] border border-rule-soft bg-surface shadow-2xl"
              >
                <div className="flex items-center gap-2.5 border-b border-rule-soft px-4 py-3.5">
                  <MagnifyingGlass size={15} weight="light" className="text-ink-faint" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Search notes, tasks, vault, templates, API collections…"
                    className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                  />
                  <kbd className="rounded bg-glass-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">Esc</kbd>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {query.trim().length < 2 ? (
                    <div className="p-4 text-center text-sm text-ink-faint">Type at least 2 characters…</div>
                  ) : loading ? (
                    <div className="p-4 text-center text-sm text-ink-faint">Searching…</div>
                  ) : results.length === 0 ? (
                    <div className="p-4 text-center text-sm text-ink-faint">No matches for "{query}"</div>
                  ) : (
                    results.map((r, i) => {
                      const active = i === activeIndex
                      return (
                        <button
                          key={`${r.tool}-${r.type}-${r.id}`}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => select(r)}
                          className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-glass-strong' : 'hover:bg-glass'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded-full bg-glass px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-cyan">{r.type}</span>
                            <span className={`flex-1 truncate text-[13px] font-medium ${active ? 'text-ink' : 'text-ink-soft'}`}>{r.title}</span>
                            <span className="shrink-0 text-[10px] text-ink-faint">{TOOL_LABEL[r.tool] ?? r.tool}</span>
                          </div>
                          {r.snippet && <div className="truncate pl-1 text-[11px] text-ink-faint">{r.snippet}</div>}
                        </button>
                      )
                    })
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
