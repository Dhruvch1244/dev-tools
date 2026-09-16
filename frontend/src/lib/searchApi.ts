export type GlobalSearchResult = { tool: string; type: string; id: string; title: string; snippet: string }

export async function globalSearch(q: string): Promise<GlobalSearchResult[]> {
  if (q.trim().length < 2) return []
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}
