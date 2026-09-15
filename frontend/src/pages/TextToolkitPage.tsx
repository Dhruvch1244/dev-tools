import { useMemo, useState } from 'react'
import { ArrowDown } from '@phosphor-icons/react'
import { Panel, SectionLabel, Button, CopyButton } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

function toCamel(s: string) {
  return s.replace(/[_\s-]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(.)/, (c) => c.toLowerCase())
}
function toSnake(s: string) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase()
}
function toKebab(s: string) {
  return toSnake(s).replace(/_/g, '-')
}
function toTitle(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

export function TextToolkitPage() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [delimiter, setDelimiter] = useState(',')
  const [columnIndex, setColumnIndex] = useState(0)
  const [wrapWidth, setWrapWidth] = useState(80)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')

  const lines = input.split('\n')
  const stats = useMemo(
    () => ({
      lines: lines.length,
      words: input.trim() ? input.trim().split(/\s+/).length : 0,
      chars: input.length,
      charsNoSpace: input.replace(/\s/g, '').length,
    }),
    [input, lines.length]
  )

  function apply(fn: (s: string) => string) {
    setOutput(fn(input))
  }
  function applyLines(fn: (lines: string[]) => string[]) {
    setOutput(fn(input.split('\n')).join('\n'))
  }

  function extractColumn() {
    const rows = input.split('\n').map((line) => line.split(delimiter)[columnIndex] ?? '')
    setOutput(rows.join('\n'))
  }

  function findReplace() {
    if (!findText) return
    setOutput(input.split(findText).join(replaceText))
  }

  function wrap() {
    applyLines((ls) =>
      ls.flatMap((line) => {
        const words = line.split(' ')
        const out: string[] = []
        let cur = ''
        for (const w of words) {
          if ((cur + ' ' + w).trim().length > wrapWidth) {
            out.push(cur.trim())
            cur = w
          } else {
            cur = (cur + ' ' + w).trim()
          }
        }
        if (cur) out.push(cur)
        return out.length ? out : ['']
      })
    )
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="text-toolkit" className="flex w-64 shrink-0 flex-col gap-3 overflow-auto">
        <Panel>
          <div className="flex flex-col gap-2 p-3">
            <SectionLabel>Case</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="default" onClick={() => apply((s) => s.toUpperCase())}>UPPER</Button>
              <Button variant="default" onClick={() => apply((s) => s.toLowerCase())}>lower</Button>
              <Button variant="default" onClick={() => apply(toTitle)}>Title Case</Button>
              <Button variant="default" onClick={() => apply(toCamel)}>camelCase</Button>
              <Button variant="default" onClick={() => apply(toSnake)}>snake_case</Button>
              <Button variant="default" onClick={() => apply(toKebab)}>kebab-case</Button>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-1.5 p-3">
            <SectionLabel>Lines</SectionLabel>
            <Button variant="default" onClick={() => applyLines((ls) => [...ls].sort())}>Sort A→Z</Button>
            <Button variant="default" onClick={() => applyLines((ls) => [...ls].sort().reverse())}>Sort Z→A</Button>
            <Button variant="default" onClick={() => applyLines((ls) => Array.from(new Set(ls)))}>Dedupe</Button>
            <Button variant="default" onClick={() => applyLines((ls) => ls.filter((l) => l.trim() !== ''))}>Remove blank lines</Button>
            <Button variant="default" onClick={() => applyLines((ls) => ls.map((l) => l.trim()))}>Trim each line</Button>
            <Button variant="default" onClick={() => applyLines((ls) => [...ls].reverse())}>Reverse order</Button>
            <Button variant="default" onClick={() => applyLines((ls) => ls.map((l, i) => `${i + 1}. ${l}`))}>Number lines</Button>
            <Button variant="default" onClick={() => applyLines((ls) => ls.map((l) => l.replace(/\s+/g, ' ')))}>Collapse spaces</Button>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-1.5 p-3">
            <SectionLabel>Find & replace</SectionLabel>
            <input className="devtools-input" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="find" />
            <input className="devtools-input" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="replace with" />
            <Button variant="default" onClick={findReplace} disabled={!findText}>Replace all</Button>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-1.5 p-3">
            <SectionLabel>Column extract</SectionLabel>
            <div className="flex gap-1.5">
              <input className="devtools-input" value={delimiter} onChange={(e) => setDelimiter(e.target.value)} placeholder="delim" />
              <input
                type="number"
                className="devtools-input"
                value={columnIndex}
                onChange={(e) => setColumnIndex(Number(e.target.value) || 0)}
              />
            </div>
            <Button variant="default" onClick={extractColumn}>Extract column</Button>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-1.5 p-3">
            <SectionLabel>Wrap</SectionLabel>
            <input type="number" className="devtools-input" value={wrapWidth} onChange={(e) => setWrapWidth(Number(e.target.value) || 80)} />
            <Button variant="default" onClick={wrap}>Wrap to width</Button>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-1 p-3 text-xs text-ink-soft">
            <SectionLabel>Stats (input)</SectionLabel>
            <div>{stats.lines} lines</div>
            <div>{stats.words} words</div>
            <div>{stats.chars} chars ({stats.charsNoSpace} no whitespace)</div>
          </div>
        </Panel>
      </ResizablePanel>

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel>Input</SectionLabel>
              <Button variant="ghost" onClick={() => setInput('')} disabled={!input}>Clear</Button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              placeholder="Paste or type text here…"
              className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-cyan/50"
            />
          </div>
        </Panel>

        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel>Output</SectionLabel>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setInput(output)} disabled={!output} title="Use output as the new input, to chain transforms">
                  <ArrowDown size={13} weight="bold" /> Use as input
                </Button>
                <CopyButton text={output} />
              </div>
            </div>
            <textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              spellCheck={false}
              placeholder="Run a transform on the left to see the result here."
              className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-cyan/50"
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}
