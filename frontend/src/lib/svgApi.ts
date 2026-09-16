export type OptimizedSvg = { svg: string; originalBytes: number; optimizedBytes: number }

export async function optimizeSvg(svg: string): Promise<OptimizedSvg> {
  const res = await fetch('/api/media/svg/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ svg }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Optimize failed')
  return res.json()
}
