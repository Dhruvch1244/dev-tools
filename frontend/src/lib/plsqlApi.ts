export type RoutineKind = 'PACKAGE' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER' | 'VIEW'
export type TableAccess = 'READ' | 'WRITE'

export type TableRef = { table: string; access: TableAccess }

export type Routine = {
  name: string
  qualifiedName: string
  kind: RoutineKind
  packageName: string | null
  filePath: string
  line: number
  calls: string[]
  tables: TableRef[]
}

export type Risk = { filePath: string; line: number; kind: string; message: string }

export type ScanResult = { filesScanned: number; routines: Routine[]; risks: Risk[] }

export async function scanPlSqlRepo(path: string): Promise<ScanResult> {
  const res = await fetch('/api/plsql/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Scan failed')
  return res.json()
}
