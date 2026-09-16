export type SqlInsertResult = { sql: string; rowCount: number; columns: string[] }

export async function csvToSql(file: File, tableName: string, delimiter: string, batchSize: number): Promise<SqlInsertResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('tableName', tableName)
  form.append('delimiter', delimiter)
  form.append('batchSize', String(batchSize))
  const res = await fetch('/api/data-convert/csv-to-sql', { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Conversion failed')
  return res.json()
}
