import { useState } from 'react'
import { UploadSimple, CloudArrowDown } from '@phosphor-icons/react'
import { parseOpenApiFile, type ImportedOpenApiRequest } from '../lib/openApiImport'
import { createCollection, listCollections, saveRequest } from '../lib/apiClientApi'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'

export function OpenApiImportPage() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [collectionName, setCollectionName] = useState('')
  const [requests, setRequests] = useState<ImportedOpenApiRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)

  async function onFile(f: File | null) {
    if (!f) return
    setError(null)
    setDoneMsg(null)
    setFileName(f.name)
    try {
      const text = await f.text()
      const parsed = parseOpenApiFile(text)
      setCollectionName(parsed.collectionName)
      setRequests(parsed.requests)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file')
      setRequests([])
    }
  }

  async function doImport() {
    if (requests.length === 0 || !collectionName.trim()) return
    setImporting(true)
    setError(null)
    setDoneMsg(null)
    try {
      const collections = await listCollections()
      let coll = collections.find((c) => c.name.toLowerCase() === collectionName.trim().toLowerCase())
      if (!coll) coll = await createCollection(collectionName.trim())
      for (const r of requests) {
        await saveRequest({
          collectionId: coll.id,
          name: r.name,
          method: r.method,
          url: r.url,
          headersJson: JSON.stringify(r.headers.filter((h) => h.key)),
          body: r.body,
        })
      }
      setDoneMsg(`Imported ${requests.length} request(s) into "${coll.name}".`)
      setRequests([])
      setFileName(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel>
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>OpenAPI / Swagger document</SectionLabel>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
            <UploadSimple size={14} weight="light" />
            <span className="truncate">{fileName ?? 'Choose an OpenAPI 3.x or Swagger 2.0 file (.yaml, .yml, .json)…'}</span>
            <input type="file" accept=".json,.yaml,.yml" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="hidden" />
          </label>
          {requests.length > 0 && (
            <>
              <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
                Target API Client collection (existing name adds to it, new name creates one)
                <input className="devtools-input" value={collectionName} onChange={(e) => setCollectionName(e.target.value)} />
              </label>
              <Button variant="primary" onClick={doImport} disabled={!collectionName.trim() || importing}>
                <CloudArrowDown size={14} weight="light" /> {importing ? 'Importing…' : `Import ${requests.length} request(s)`}
              </Button>
            </>
          )}
          {doneMsg && <div className="text-[11.5px] text-emerald">{doneMsg}</div>}
        </div>
      </Panel>

      {error && <ErrorBanner message={error} />}

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-3">
          {requests.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">Parsed operations will be previewed here before import.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {requests.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-glass px-2.5 py-1.5 text-xs">
                  <span className="w-14 shrink-0 font-mono text-[10px] font-semibold text-cyan">{r.method}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="shrink-0 truncate font-mono text-[10.5px] text-ink-faint" style={{ maxWidth: '40%' }}>{r.url}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
