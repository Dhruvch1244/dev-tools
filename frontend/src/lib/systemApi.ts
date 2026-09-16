export type SystemInfo = {
  javaVersion: string
  os: string
  startedAt: string
  uptimeSeconds: number
  dbPath: string
  dbSizeBytes: number
  heapUsedBytes: number
  heapMaxBytes: number
  availableProcessors: number
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const res = await fetch('/api/system/info')
  if (!res.ok) throw new Error('Failed to load system info')
  return res.json()
}

export async function exportBackup(): Promise<{ blob: Blob; fileName: string }> {
  const res = await fetch('/api/backup/export')
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: 'Backup export failed' }))).error)
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const fileName = match ? match[1] : 'devtools-backup.zip'
  return { blob: await res.blob(), fileName }
}

export async function importBackup(file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/backup/import', { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: 'Restore failed' }))).error ?? 'Restore failed')
}
