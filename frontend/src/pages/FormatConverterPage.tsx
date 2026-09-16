import { useState } from 'react'
import { ArrowRight, ArrowsClockwise } from '@phosphor-icons/react'
import { convertConfig, type ConfigFormat } from '../lib/formatConvert'
import { Panel, SectionLabel, Button, ErrorBanner, CopyButton } from '../components/ui'

const FORMATS: { id: ConfigFormat; label: string }[] = [
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'toml', label: 'TOML' },
  { id: 'properties', label: '.properties' },
]

const SAMPLE = `{
  "server": { "port": 8080 },
  "app": { "name": "demo", "debug": true }
}`

export function FormatConverterPage() {
  const [from, setFrom] = useState<ConfigFormat>('json')
  const [to, setTo] = useState<ConfigFormat>('yaml')
  const [input, setInput] = useState(SAMPLE)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  function run() {
    setError(null)
    try {
      setOutput(convertConfig(input, from, to))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
      setOutput('')
    }
  }

  function swap() {
    setFrom(to)
    setTo(from)
    setInput(output || input)
    setOutput('')
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel>
        <div className="flex items-center gap-2 p-3">
          <select className="devtools-input w-auto text-xs" value={from} onChange={(e) => setFrom(e.target.value as ConfigFormat)}>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <button onClick={swap} title="Swap and use output as new input" className="rounded-full p-1.5 text-ink-faint hover:bg-glass hover:text-cyan">
            <ArrowsClockwise size={14} weight="light" />
          </button>
          <ArrowRight size={13} weight="light" className="text-ink-faint" />
          <select className="devtools-input w-auto text-xs" value={to} onChange={(e) => setTo(e.target.value as ConfigFormat)}>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <Button variant="primary" onClick={run} className="ml-2">Convert</Button>
        </div>
      </Panel>

      {error && <ErrorBanner message={error} />}

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden">
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-2 p-3">
            <SectionLabel>{FORMATS.find((f) => f.id === from)?.label} input</SectionLabel>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-cyan/50"
            />
          </div>
        </Panel>

        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <SectionLabel>{FORMATS.find((f) => f.id === to)?.label} output</SectionLabel>
              {output && <CopyButton text={output} />}
            </div>
            <pre className="flex-1 overflow-auto rounded-2xl border border-rule bg-panel p-3 font-mono text-[12px] leading-relaxed text-ink">
              {output || <span className="text-ink-faint">Converted output appears here.</span>}
            </pre>
          </div>
        </Panel>
      </div>
    </div>
  )
}
