export type Row = Record<string, string>

export function parseTable(text: string): { columns: string[]; rows: Row[] } {
  const trimmed = text.trim()
  if (!trimmed) return { columns: [], rows: [] }
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as Record<string, unknown>[]
    const columns = Array.from(new Set(arr.flatMap((o) => Object.keys(o))))
    const rows = arr.map((o) => {
      const row: Row = {}
      for (const c of columns) row[c] = o[c] === undefined || o[c] === null ? '' : String(o[c])
      return row
    })
    return { columns, rows }
  }
  const lines = trimmed.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return { columns: [], rows: [] }
  const columns = splitCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const row: Row = {}
    columns.forEach((c, i) => (row[c] = cells[i] ?? ''))
    return row
  })
  return { columns, rows }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export type RowDiffResult = {
  columns: string[]
  onlyInA: Row[]
  onlyInB: Row[]
  changed: { key: string; a: Row; b: Row; changedColumns: string[] }[]
  unchangedCount: number
}

export function diffRows(a: { columns: string[]; rows: Row[] }, b: { columns: string[]; rows: Row[] }, keyColumn: string): RowDiffResult {
  const columns = Array.from(new Set([...a.columns, ...b.columns]))
  const bByKey = new Map(b.rows.map((r) => [r[keyColumn], r]))
  const aKeys = new Set(a.rows.map((r) => r[keyColumn]))

  const onlyInA: Row[] = []
  const changed: RowDiffResult['changed'] = []
  let unchangedCount = 0

  for (const rowA of a.rows) {
    const key = rowA[keyColumn]
    const rowB = bByKey.get(key)
    if (!rowB) {
      onlyInA.push(rowA)
      continue
    }
    const changedColumns = columns.filter((c) => c !== keyColumn && (rowA[c] ?? '') !== (rowB[c] ?? ''))
    if (changedColumns.length > 0) changed.push({ key, a: rowA, b: rowB, changedColumns })
    else unchangedCount++
  }

  const onlyInB = b.rows.filter((r) => !aKeys.has(r[keyColumn]))

  return { columns, onlyInA, onlyInB, changed, unchangedCount }
}
