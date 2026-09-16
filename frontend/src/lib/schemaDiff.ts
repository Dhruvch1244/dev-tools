export type ColumnDef = { name: string; type: string; nullable: boolean; hasDefault: boolean }
export type TableDef = { name: string; columns: ColumnDef[] }

export type ColumnChange =
  | { kind: 'added-column'; table: string; column: ColumnDef; risky: boolean; reason?: string }
  | { kind: 'dropped-column'; table: string; column: ColumnDef; risky: boolean; reason?: string }
  | { kind: 'changed-column'; table: string; before: ColumnDef; after: ColumnDef; risky: boolean; reason?: string }

export type SchemaDiffResult = {
  addedTables: string[]
  droppedTables: string[]
  changes: ColumnChange[]
}

/** Parses `CREATE TABLE name (...)` blocks from a SQL script — a pragmatic subset, not a full DDL parser. */
export function parseSchema(sql: string): TableDef[] {
  const tables: TableDef[] = []
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([\w.]+)["'`]?\s*\(/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(sql))) {
    const start = match.index + match[0].length
    const body = extractParenBody(sql, start - 1)
    if (body === null) continue
    const columns = splitTopLevel(body, ',')
      .map((c) => c.trim())
      .filter((c) => c && !/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CONSTRAINT|CHECK|INDEX|KEY)\b/i.test(c))
      .map(parseColumn)
      .filter((c): c is ColumnDef => c !== null)
    tables.push({ name: match[1], columns })
  }
  return tables
}

function extractParenBody(s: string, openParenIndex: number): string | null {
  let depth = 0
  for (let i = openParenIndex; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) return s.slice(openParenIndex + 1, i)
    }
  }
  return null
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

function parseColumn(def: string): ColumnDef | null {
  const m = def.match(/^["'`]?([\w]+)["'`]?\s+([\w()0-9,\s]+?)(?:\s+(NOT\s+NULL|NULL))?(\s+DEFAULT\s+\S+)?(?:\s|$)/i)
  if (!m) return null
  return {
    name: m[1],
    type: m[2].trim().replace(/\s+/g, ' '),
    nullable: !(m[3] && /NOT\s+NULL/i.test(m[3])),
    hasDefault: !!m[4],
  }
}

export function diffSchemas(before: TableDef[], after: TableDef[]): SchemaDiffResult {
  const beforeMap = new Map(before.map((t) => [t.name.toLowerCase(), t]))
  const afterMap = new Map(after.map((t) => [t.name.toLowerCase(), t]))

  const addedTables = after.filter((t) => !beforeMap.has(t.name.toLowerCase())).map((t) => t.name)
  const droppedTables = before.filter((t) => !afterMap.has(t.name.toLowerCase())).map((t) => t.name)

  const changes: ColumnChange[] = []
  for (const [key, beforeTable] of beforeMap) {
    const afterTable = afterMap.get(key)
    if (!afterTable) continue
    const beforeCols = new Map(beforeTable.columns.map((c) => [c.name.toLowerCase(), c]))
    const afterCols = new Map(afterTable.columns.map((c) => [c.name.toLowerCase(), c]))

    for (const [ck, col] of beforeCols) {
      if (!afterCols.has(ck)) {
        changes.push({ kind: 'dropped-column', table: beforeTable.name, column: col, risky: true, reason: 'Dropping a column is a data-loss risk.' })
      }
    }
    for (const [ck, col] of afterCols) {
      const before2 = beforeCols.get(ck)
      if (!before2) {
        const risky = !col.nullable && !col.hasDefault
        changes.push({
          kind: 'added-column',
          table: afterTable.name,
          column: col,
          risky,
          reason: risky ? 'NOT NULL column added with no DEFAULT — will fail against existing rows.' : undefined,
        })
        continue
      }
      if (before2.type !== col.type || before2.nullable !== col.nullable) {
        const becameNotNull = before2.nullable && !col.nullable
        const risky = becameNotNull && !col.hasDefault
        changes.push({
          kind: 'changed-column',
          table: afterTable.name,
          before: before2,
          after: col,
          risky,
          reason: risky
            ? 'Column changed to NOT NULL with no DEFAULT — will fail against existing NULL rows.'
            : before2.type !== col.type
              ? 'Type changed — verify existing data still fits.'
              : undefined,
        })
      }
    }
  }

  return { addedTables, droppedTables, changes }
}
