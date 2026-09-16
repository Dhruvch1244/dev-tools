import { useMemo, useRef, useState } from 'react'
import { diffLines, diffWords, groupDiffRows, type DiffRow } from '../lib/diff'
import { Panel, SectionLabel, CopyButton } from '../components/ui'

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
}

/**
 * Reconstructs one side's exact original text as HTML, wrapping only the differing words/lines
 * in a <mark> span — used as a same-text overlay drawn behind the (transparent-background)
 * textarea so live diff highlighting shows through underneath what you're typing.
 */
function buildHighlightHtml(rows: DiffRow[], side: 'before' | 'after'): string {
  const lines: string[] = []
  for (const row of rows) {
    if (row.kind === 'equal') {
      lines.push(escapeHtml(row.line))
      continue
    }
    if (row.kind === 'remove') {
      if (side === 'before') lines.push(`<mark class="diff-hl">${escapeHtml(row.line)}</mark>`)
      continue
    }
    if (row.kind === 'add') {
      if (side === 'after') lines.push(`<mark class="diff-hl">${escapeHtml(row.line)}</mark>`)
      continue
    }
    // kind === 'change': word-level highlight for just the differing tokens
    const changeRow = row as Extract<DiffRow, { kind: 'change' }>
    const wordOps = diffWords(changeRow.before, changeRow.after)
    const keep = side === 'before' ? 'remove' : 'add'
    const skip = side === 'before' ? 'add' : 'remove'
    const html = wordOps
      .filter((w) => w.type !== skip)
      .map((w) => (w.type === keep ? `<mark class="diff-hl">${escapeHtml(w.text)}</mark>` : escapeHtml(w.text)))
      .join('')
    lines.push(html)
  }
  return lines.join('\n')
}

export function DiffPage() {
  const [before, setBefore] = useState('')
  const [after, setAfter] = useState('')
  const beforeOverlayRef = useRef<HTMLDivElement>(null)
  const afterOverlayRef = useRef<HTMLDivElement>(null)

  const ops = useMemo(() => diffLines(before, after), [before, after])
  const rows = useMemo(() => groupDiffRows(ops), [ops])
  const added = ops.filter((o) => o.type === 'add').length
  const removed = ops.filter((o) => o.type === 'remove').length

  const beforeHtml = useMemo(() => buildHighlightHtml(rows, 'before'), [rows])
  const afterHtml = useMemo(() => buildHighlightHtml(rows, 'after'), [rows])

  function syncScroll(source: HTMLTextAreaElement, overlay: HTMLDivElement | null) {
    if (!overlay) return
    overlay.scrollTop = source.scrollTop
    overlay.scrollLeft = source.scrollLeft
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col p-4">
            <SectionLabel>Before</SectionLabel>
            <div className="relative flex-1">
              <div
                ref={beforeOverlayRef}
                aria-hidden
                dangerouslySetInnerHTML={{ __html: beforeHtml }}
                className="diff-overlay pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-all rounded-2xl p-3.5 font-mono text-[13px] leading-relaxed text-transparent"
              />
              <textarea
                value={before}
                onChange={(e) => setBefore(e.target.value)}
                onScroll={(e) => syncScroll(e.currentTarget, beforeOverlayRef.current)}
                spellCheck={false}
                placeholder="Paste the original text…"
                className="relative h-full w-full resize-none rounded-2xl border border-rule bg-transparent p-3.5 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-cyan/50"
              />
            </div>
          </div>
        </Panel>
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col p-4">
            <SectionLabel>After</SectionLabel>
            <div className="relative flex-1">
              <div
                ref={afterOverlayRef}
                aria-hidden
                dangerouslySetInnerHTML={{ __html: afterHtml }}
                className="diff-overlay pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-all rounded-2xl p-3.5 font-mono text-[13px] leading-relaxed text-transparent"
              />
              <textarea
                value={after}
                onChange={(e) => setAfter(e.target.value)}
                onScroll={(e) => syncScroll(e.currentTarget, afterOverlayRef.current)}
                spellCheck={false}
                placeholder="Paste the changed text…"
                className="relative h-full w-full resize-none rounded-2xl border border-rule bg-transparent p-3.5 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-cyan/50"
              />
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="flex max-h-[45%] shrink-0 flex-col">
        <div className="flex flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs text-ink-soft">
              <span className="text-emerald">+{added}</span> <span className="text-rose">-{removed}</span>
            </div>
            <CopyButton text={ops.map((o) => (o.type === 'add' ? '+ ' : o.type === 'remove' ? '- ' : '  ') + o.line).join('\n')} />
          </div>
          <div className="max-h-72 overflow-auto rounded-2xl border border-rule bg-panel font-mono text-[12.5px]">
            {before === '' && after === '' ? (
              <div className="p-3 text-ink-faint">Paste text in both panes to see the diff — differences highlight live in yellow as you type.</div>
            ) : (
              rows.map((row, i) => {
                if (row.kind === 'change') {
                  const wordOps = diffWords(row.before, row.after)
                  return (
                    <div key={i}>
                      <div className="whitespace-pre-wrap break-all bg-rose/[0.08] px-3 py-0.5 text-rose">
                        {'- '}
                        {wordOps
                          .filter((w) => w.type !== 'add')
                          .map((w, wi) => (
                            <span key={wi} className={w.type === 'remove' ? 'rounded bg-rose/25 text-rose' : undefined}>
                              {w.text}
                            </span>
                          ))}
                      </div>
                      <div className="whitespace-pre-wrap break-all bg-emerald/[0.08] px-3 py-0.5 text-emerald">
                        {'+ '}
                        {wordOps
                          .filter((w) => w.type !== 'remove')
                          .map((w, wi) => (
                            <span key={wi} className={w.type === 'add' ? 'rounded bg-emerald/25 text-emerald' : undefined}>
                              {w.text}
                            </span>
                          ))}
                      </div>
                    </div>
                  )
                }
                return (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap break-all px-3 py-0.5 ${
                      row.kind === 'add' ? 'bg-emerald/[0.08] text-emerald' : row.kind === 'remove' ? 'bg-rose/[0.08] text-rose' : 'text-ink-soft'
                    }`}
                  >
                    {row.kind === 'add' ? '+ ' : row.kind === 'remove' ? '- ' : '  '}
                    {row.line}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}
