import { useMemo, useState } from 'react'
import {
  diffFlat,
  flatToProperties,
  flatToYaml,
  mergeWithOrigin,
  parseEnvOverrides,
  parsePropertiesToFlat,
  parseYamlToFlat,
  resolvePlaceholders,
  type FlatMap,
} from '../lib/springConfig'
import { Panel, SectionLabel, ErrorBanner, CopyButton } from '../components/ui'

type Format = 'yaml' | 'properties'
type Mode = 'diff' | 'effective'

const ORIGIN_COLOR: Record<string, string> = { Base: 'text-ink-faint', Profile: 'text-cyan', Env: 'text-emerald' }

function parse(text: string, format: Format): { flat: FlatMap; error: string | null } {
  if (!text.trim()) return { flat: {}, error: null }
  try {
    return { flat: format === 'yaml' ? parseYamlToFlat(text) : parsePropertiesToFlat(text), error: null }
  } catch (e) {
    return { flat: {}, error: e instanceof Error ? e.message : 'Parse failed' }
  }
}

export function SpringConfigPage() {
  const [mode, setMode] = useState<Mode>('diff')
  const [format, setFormat] = useState<Format>('yaml')
  const [textA, setTextA] = useState('server:\n  port: 8080\napp:\n  name: myapp\n  greeting: "Hello, ${app.name}!"')
  const [textB, setTextB] = useState('')
  const [envText, setEnvText] = useState('')

  const a = parse(textA, format)
  const b = parse(textB, format)
  const rows = useMemo(() => diffFlat(a.flat, b.flat), [a.flat, b.flat])
  const resolvedA = useMemo(() => resolvePlaceholders(a.flat), [a.flat])

  const envFlat = useMemo(() => parseEnvOverrides(envText), [envText])
  const { merged, origin } = useMemo(
    () => mergeWithOrigin([{ label: 'Base', flat: a.flat }, { label: 'Profile', flat: b.flat }, { label: 'Env', flat: envFlat }]),
    [a.flat, b.flat, envFlat]
  )
  const effective = useMemo(() => resolvePlaceholders(merged), [merged])

  const converted = format === 'yaml' ? flatToProperties(a.flat) : flatToYaml(a.flat)

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-3">
        <div className="flex gap-1 rounded-2xl border border-rule bg-panel p-1">
          {(['diff', 'effective'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
                mode === m ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'
              }`}
            >
              {m === 'diff' ? 'Diff A vs B' : 'Effective Config'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-2xl border border-rule bg-panel p-1">
          {(['yaml', 'properties'] as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
                format === f ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'
              }`}
            >
              {f === 'yaml' ? 'YAML' : 'Properties'}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid flex-1 gap-4 overflow-hidden ${mode === 'effective' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col p-4">
            <SectionLabel>Base (application.{format === 'yaml' ? 'yml' : 'properties'})</SectionLabel>
            <textarea
              value={textA}
              onChange={(e) => setTextA(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[13px] text-ink outline-none focus:border-cyan/50"
            />
            {a.error && <ErrorBanner message={a.error} />}
          </div>
        </Panel>
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-1 flex-col p-4">
            <SectionLabel>{mode === 'diff' ? 'Profile B (optional — leave blank to just resolve/convert A)' : 'Profile overrides (optional, e.g. application-prod.yml)'}</SectionLabel>
            <textarea
              value={textB}
              onChange={(e) => setTextB(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[13px] text-ink outline-none focus:border-cyan/50"
            />
            {b.error && <ErrorBanner message={b.error} />}
          </div>
        </Panel>
        {mode === 'effective' && (
          <Panel className="flex flex-col overflow-hidden">
            <div className="flex flex-1 flex-col p-4">
              <SectionLabel>Env var overrides (optional — one KEY=VALUE per line, highest precedence)</SectionLabel>
              <textarea
                value={envText}
                onChange={(e) => setEnvText(e.target.value)}
                spellCheck={false}
                placeholder={'SERVER_PORT=9090\nAPP_DATASOURCE_URL=jdbc:...'}
                className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[13px] text-ink outline-none focus:border-cyan/50"
              />
              <div className="mt-2 text-[11px] text-ink-faint">
                Applies Spring Boot's relaxed binding: lowercased, <code>_</code> → <code>.</code> —{' '}
                <code>SERVER_PORT</code> becomes <code>server.port</code>.
              </div>
            </div>
          </Panel>
        )}
      </div>

      <div className="grid max-h-64 grid-cols-2 gap-4">
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            {mode === 'diff' ? (
              <>
                <SectionLabel>{textB.trim() ? 'Diff (A vs B)' : `Resolved placeholders (A)${resolvedA.unresolved.length ? ' — ' + resolvedA.unresolved.length + ' unresolved' : ''}`}</SectionLabel>
                <div className="flex flex-col gap-0.5 font-mono text-[11.5px]">
                  {textB.trim()
                    ? rows
                        .filter((r) => r.status !== 'same')
                        .map((r) => (
                          <div key={r.key} className={r.status === 'onlyA' ? 'text-rose' : r.status === 'onlyB' ? 'text-emerald' : 'text-warm'}>
                            {r.key}: {r.a ?? '—'} → {r.b ?? '—'}
                          </div>
                        ))
                    : Object.entries(resolvedA.resolved).map(([k, v]) => (
                        <div key={k} className={resolvedA.unresolved.some((u) => v.includes('${' + u)) ? 'text-rose' : 'text-ink-soft'}>
                          {k} = {v}
                        </div>
                      ))}
                </div>
              </>
            ) : (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <SectionLabel>
                    Effective config{effective.unresolved.length ? ` — ${effective.unresolved.length} unresolved placeholder(s)` : ''}
                  </SectionLabel>
                  <CopyButton text={Object.entries(effective.resolved).map(([k, v]) => `${k}=${v}`).join('\n')} />
                </div>
                <div className="flex flex-col gap-0.5 font-mono text-[11.5px]">
                  {Object.keys(effective.resolved).length === 0 ? (
                    <div className="text-ink-faint">Fill in Base (and optionally Profile/Env) to see the merged, resolved result.</div>
                  ) : (
                    Object.entries(effective.resolved).map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-2">
                        <span className={`w-14 shrink-0 text-[9.5px] uppercase tracking-wide ${ORIGIN_COLOR[origin[k]] ?? 'text-ink-faint'}`}>
                          {origin[k]}
                        </span>
                        <span className={effective.unresolved.some((u) => v.includes('${' + u)) ? 'text-rose' : 'text-ink-soft'}>
                          {k} = {v}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </Panel>
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            <div className="mb-1 flex items-center justify-between">
              <SectionLabel>Converted to {format === 'yaml' ? 'properties' : 'YAML'}</SectionLabel>
              <CopyButton text={converted} />
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11.5px] text-ink-soft">{converted}</pre>
          </div>
        </Panel>
      </div>
    </div>
  )
}
