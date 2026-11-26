import { useMemo, useState } from 'react'
import { lintManifests, SAMPLE_MANIFEST } from '../lib/k8sLint'
import { Badge, Button, ErrorBanner, Panel, Segmented, SectionLabel, TextArea } from '../components/ui'
import { FindingRow, Score } from './LintParts'

const LS = 'devtools.k8s-lint.input'

export function K8sLintPage() {
  const [src, setSrc] = useState(() => localStorage.getItem(LS) ?? SAMPLE_MANIFEST)
  const [level, setLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all')
  const res = useMemo(() => lintManifests(src), [src])
  const errors = res.findings.filter((f) => f.level === 'error').length
  const warns = res.findings.filter((f) => f.level === 'warn').length
  const shown = res.findings.filter((f) => level === 'all' || f.level === level)
  const kinds = res.resources.reduce<Record<string, number>>((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {})

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-xl:[&>*]:shrink-0 xl:flex-row xl:overflow-hidden">
      <Panel className="xl:w-[min(34rem,42%)] xl:shrink-0">
        <div className="flex h-full min-h-[24rem] flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Manifests (multi-doc YAML, --- separated)</SectionLabel>
            <div className="flex gap-1"><Button variant="ghost" onClick={() => setSrc(SAMPLE_MANIFEST)}>Sample</Button><Button variant="ghost" onClick={() => setSrc('')}>Clear</Button></div>
          </div>
          <TextArea value={src} onChange={(e) => { setSrc(e.target.value); try { localStorage.setItem(LS, e.target.value) } catch { /* ignore */ } }} placeholder="apiVersion: apps/v1…   (tip: paste `helm template` output)" />
        </div>
      </Panel>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:overflow-y-auto [&>*]:shrink-0">
        {res.parseError && <ErrorBanner message={res.parseError} />}
        <Panel>
          <div className="flex flex-wrap items-center gap-6 p-5">
            <Score errors={errors} warns={warns} />
            <div className="flex flex-wrap gap-2">
              {Object.entries(kinds).map(([k, n]) => <Badge key={k} tone="cyan">{n}× {k}</Badge>)}
            </div>
            <div className="ml-auto"><Segmented id="k8s-level" size="sm" value={level} onChange={setLevel} options={[{ id: 'all', label: `All ${res.findings.length}` }, { id: 'error', label: `Errors ${errors}` }, { id: 'warn', label: `Warnings ${warns}` }, { id: 'info', label: 'Info' }]} /></div>
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-2 p-5">
            <SectionLabel>Findings</SectionLabel>
            {shown.length === 0 && <div className="text-emerald">Nothing to flag at this level.</div>}
            {shown.map((f, i) => <FindingRow key={i} i={i} level={f.level} where={f.resource} message={f.message} />)}
          </div>
        </Panel>
        {res.images.length > 0 && (
          <Panel>
            <div className="flex flex-col gap-2 p-5">
              <SectionLabel>Images</SectionLabel>
              {res.images.map((im, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
                  <span className="text-ink-faint">{im.resource} › {im.container}</span>
                  <span className="break-all font-mono text-ink">{im.image}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
