export type MigrationTool = 'FLYWAY' | 'LIQUIBASE'
export type Risk = { filePath: string; line: number; kind: string; message: string }

export type MigrationEntry = {
  version: string
  description: string
  fileName: string
  filePath: string
  tool: MigrationTool
  risks: Risk[]
}

export type ScanResult = { filesScanned: number; migrations: MigrationEntry[]; risks: Risk[] }

export async function scanMigrations(path: string): Promise<ScanResult> {
  const res = await fetch('/api/migrations/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Scan failed')
  return res.json()
}
