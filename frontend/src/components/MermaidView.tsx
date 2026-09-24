import { useEffect, useState } from 'react'
import { renderMermaid } from '../lib/mermaidRender'
import { getCurrentScheme } from '../lib/themes'
import { ErrorBanner } from './ui'

export function MermaidView({ code, onSvgReady }: { code: string; onSvgReady?: (svg: string | null) => void }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scheme, setScheme] = useState(getCurrentScheme)

  useEffect(() => {
    const onTheme = () => setScheme(getCurrentScheme())
    window.addEventListener('devtools:themechange', onTheme)
    return () => window.removeEventListener('devtools:themechange', onTheme)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!code.trim()) {
      setSvg(null)
      onSvgReady?.(null)
      setError(null)
      return
    }
    const t = setTimeout(() => {
      renderMermaid(code, scheme)
        .then((s) => {
          if (!cancelled) {
            setSvg(s)
            onSvgReady?.(s)
            setError(null)
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : 'Could not render this diagram')
            setSvg(null)
            onSvgReady?.(null)
          }
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [code, scheme])

  if (error) return <ErrorBanner message={error} />
  if (!svg) return <div className="text-sm text-ink-faint">Write some Mermaid syntax to see it rendered.</div>

  return <div className="mermaid-svg-host flex items-center justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
}
