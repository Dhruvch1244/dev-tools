import { useState } from 'react'
import { Database, UploadSimple } from '@phosphor-icons/react'
import { csvToSql, type SqlInsertResult } from '../lib/dataConvertApi'
import { Panel, SectionLabel, Button, ErrorBanner, CopyButton } from '../components/ui'

export function SqlInsertPage() {
  const [file, setFile] = useState<File | null>(null)
  const [tableName, setTableName] = useState('my_table')
  const [delimiter, setDelimiter] = useState(',')
  const [batchSize, setBatchSize] = useState(500)
  const [result, setResult] = useState<SqlInsertResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!file || !tableName.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResult(await csvToSql(file, tableName.trim(), delimiter, batchSize))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full gap-4">
      <Panel className="flex w-80 shrink-0 flex-col overflow-hidden">
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>File</SectionLabel>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
            <UploadSimple size={14} weight="light" />
            <span className="truncate">{file ? file.name : 'Choose a CSV or Excel file…'}</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          </label>

          <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
            Table name
            <input className="devtools-input font-mono" value={tableName} onChange={(e) => setTableName(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
            CSV delimiter
            <input className="devtools-input font-mono" value={delimiter} onChange={(e) => setDelimiter(e.target.value)} maxLength={1} />
          </label>

          <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
            <div className="flex items-center justify-between">
              <span>Rows per INSERT batch</span>
              <span className="font-mono text-ink-faint">{batchSize}</span>
            </div>
            <input type="range" min={1} max={1000} step={10} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="accent-cyan" />
          </label>

          <Button variant="primary" onClick={run} disabled={!file || !tableName.trim() || loading}>
            <Database size={14} weight="light" /> {loading ? 'Converting…' : 'Generate SQL'}
          </Button>
        </div>
      </Panel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col p-4">
          {error && <ErrorBanner message={error} />}
          {!error && !result && (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">Generated INSERT statements appear here.</div>
          )}
          {result && (
            <>
              <div className="mb-2 flex items-center justify-between text-[11px] text-ink-faint">
                <span>{result.rowCount.toLocaleString()} rows · {result.columns.length} columns</span>
                <CopyButton text={result.sql} />
              </div>
              <pre className="flex-1 overflow-auto rounded-2xl border border-rule bg-panel p-3 font-mono text-[12px] leading-relaxed text-ink">
                {result.sql}
              </pre>
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}
