export type LogTailChunk = { lines: string[]; offset: number; truncated: boolean }

export async function readLogTail(path: string, offset: number): Promise<LogTailChunk> {
  const res = await fetch(`/api/logtail/read?path=${encodeURIComponent(path)}&offset=${offset}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Failed to read log')
  return res.json()
}

export type TemplateGroup = { template: string; count: number; example: string }
export type MineResult = { linesScanned: number; templates: TemplateGroup[] }

export async function mineLogPatterns(path: string): Promise<MineResult> {
  const res = await fetch('/api/logmine/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Analysis failed')
  return res.json()
}
