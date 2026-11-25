import { useMemo, useState } from 'react'
import { Warning } from '@phosphor-icons/react'
import { parseCurl, render, TARGETS, type Target } from '../lib/curl'
import { Badge, CodeOut, Panel, Segmented, SectionLabel, TextArea } from '../components/ui'

const SAMPLE = `curl 'https://api.example.com/v1/orders?status=OPEN' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.demo' \\
  --data-raw '{"customerId": 42, "items": [{"sku": "A-1", "qty": 2}], "express": true}' \\
  --compressed -L`

export function CurlConvertPage() {
  const [src, setSrc] = useState(SAMPLE)
  const [target, setTarget] = useState<Target>('fetch')
  const req = useMemo(() => parseCurl(src), [src])
  const out = useMemo(() => (req.url ? render(req, target) : ''), [req, target])

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <SectionLabel>Paste a curl command (bash, cmd or "Copy as cURL" from DevTools)</SectionLabel>
          <TextArea value={src} onChange={(e) => setSrc(e.target.value)} className="!flex-none h-44" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">{req.method}</Badge>
            <span className="min-w-0 break-all font-mono text-[0.9375rem] text-ink">{req.url || '—'}</span>
            {req.headers.length > 0 && <Badge>{req.headers.length} headers</Badge>}
            {req.body !== null && <Badge tone="violet">body {req.body.length} chars</Badge>}
            {req.form.length > 0 && <Badge tone="violet">{req.form.length} form fields</Badge>}
            {req.basicAuth && <Badge tone="warm">basic auth</Badge>}
            {req.insecure && <Badge tone="rose">-k insecure</Badge>}
          </div>
          {req.warnings.map((w) => <div key={w} className="flex items-center gap-2 text-[0.875rem] text-warm"><Warning size={15} weight="fill" /> {w}</div>)}
        </div>
      </Panel>
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <Segmented id="curl-target" size="sm" value={target} onChange={setTarget} options={TARGETS.map((t) => ({ id: t.id, label: t.label }))} />
          <CodeOut text={out} />
        </div>
      </Panel>
    </div>
  )
}
