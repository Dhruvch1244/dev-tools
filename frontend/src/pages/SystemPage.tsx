import { useEffect, useRef, useState } from 'react'
import { CircleNotch, CloudArrowDown, CloudArrowUp, Info, Warning } from '@phosphor-icons/react'
import { exportBackup, getSystemInfo, importBackup, type SystemInfo } from '../lib/systemApi'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = -1
  do {
    value /= 1024
    unit++
  } while (value >= 1024 && unit < units.length - 1)
  return `${value.toFixed(1)} ${units[unit]}`
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function SystemPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<File | null>(null)
  const [restoredOk, setRestoredOk] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = () => getSystemInfo().then(setInfo).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [])

  async function runExport() {
    setError(null)
    setExporting(true)
    try {
      const { blob, fileName } = await exportBackup()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup export failed')
    } finally {
      setExporting(false)
    }
  }

  function pickRestoreFile() {
    fileInputRef.current?.click()
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setConfirmRestore(file)
  }

  async function runImport() {
    if (!confirmRestore) return
    setError(null)
    setImporting(true)
    try {
      await importBackup(confirmRestore)
      setConfirmRestore(null)
      setRestoredOk(true)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {error && <ErrorBanner message={error} />}

      <Panel>
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>System</SectionLabel>
          {!info ? (
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <CircleNotch size={14} weight="light" className="animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
              <Field label="Uptime" value={formatUptime(info.uptimeSeconds)} />
              <Field label="Java" value={info.javaVersion} />
              <Field label="OS" value={info.os} />
              <Field label="CPU cores" value={String(info.availableProcessors)} />
              <Field label="Heap used" value={`${formatBytes(info.heapUsedBytes)} / ${formatBytes(info.heapMaxBytes)}`} />
              <Field label="Database size" value={formatBytes(info.dbSizeBytes)} />
              <Field label="Database path" value={info.dbPath} mono className="col-span-2 sm:col-span-3" />
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>Backup &amp; restore</SectionLabel>
          <div className="text-[11.5px] text-ink-faint">
            Exports every tool's data — history, vault, notes, tasks, command templates, everything — as one file.
            Restoring replaces all current local data with the contents of the backup.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={runExport} disabled={exporting}>
              {exporting ? <CircleNotch size={14} weight="light" className="animate-spin" /> : <CloudArrowDown size={14} weight="bold" />}
              Export backup
            </Button>
            <Button variant="ghost" onClick={pickRestoreFile} disabled={importing}>
              <CloudArrowUp size={14} weight="bold" /> Restore from backup…
            </Button>
            <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={onFileChosen} />
          </div>

          {restoredOk && (
            <div className="flex items-center gap-2 rounded-xl border border-rule-soft bg-glass px-3 py-2 text-[11.5px] text-ink-soft">
              <Info size={14} weight="light" className="shrink-0 text-cyan" />
              Restore complete. Data in every tool has been replaced with the backup's contents.
            </div>
          )}

          {confirmRestore && (
            <div className="flex flex-col gap-2 rounded-xl border border-rose/40 bg-rose/5 p-3">
              <div className="flex items-start gap-2 text-[11.5px] text-ink-soft">
                <Warning size={14} weight="bold" className="mt-0.5 shrink-0 text-rose" />
                <span>
                  Restoring <span className="font-mono text-ink">{confirmRestore.name}</span> permanently replaces all current
                  data in every tool. This can't be undone unless you have a separate backup of the current state.
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={runImport} disabled={importing}>
                  {importing ? <CircleNotch size={14} weight="light" className="animate-spin" /> : null}
                  Confirm restore
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRestore(null)} disabled={importing}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

function Field({ label, value, mono, className = '' }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</span>
      <span className={`truncate text-ink-soft ${mono ? 'font-mono' : ''}`} title={value}>{value}</span>
    </div>
  )
}
