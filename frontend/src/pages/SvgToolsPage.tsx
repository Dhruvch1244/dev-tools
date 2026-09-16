import { useMemo, useState } from 'react'
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react'
import { optimizeSvg } from '../lib/svgApi'
import { downloadBlob, downloadText, rasterToSvgWrapper, svgToRaster, traceImageToSvg } from '../lib/svgTools'
import { Button, Panel, SectionLabel, ErrorBanner, CopyButton } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

type Tab = 'optimize' | 'convert' | 'editor' | 'trace'
const TABS: { id: Tab; label: string }[] = [
  { id: 'optimize', label: 'Optimize' },
  { id: 'convert', label: 'Convert' },
  { id: 'editor', label: 'Editor' },
  { id: 'trace', label: 'Trace' },
]

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="50" fill="#2fe6f2" />
  <path d="M40 60 L55 75 L85 40" stroke="#050506" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
</svg>`

function formatBytes(n: number): string {
  if (n > 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

export function SvgToolsPage() {
  const [tab, setTab] = useState<Tab>('optimize')

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="svg-tools" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-1 p-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-medium ${tab === t.id ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Panel>
      </ResizablePanel>

      {tab === 'optimize' && <OptimizeTab />}
      {tab === 'convert' && <ConvertTab />}
      {tab === 'editor' && <EditorTab />}
      {tab === 'trace' && <TraceTab />}
    </div>
  )
}

function OptimizeTab() {
  const [input, setInput] = useState(SAMPLE_SVG)
  const [result, setResult] = useState<{ svg: string; originalBytes: number; optimizedBytes: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      setResult(await optimizeSvg(input))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimize failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const savingsPct = result ? Math.round((1 - result.optimizedBytes / Math.max(1, result.originalBytes)) * 100) : null

  return (
    <>
      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>SVG source</SectionLabel>
            <Button variant="primary" onClick={run} disabled={!input.trim() || loading}>
              {loading ? 'Optimizing…' : 'Optimize'}
            </Button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-cyan/50"
          />
        </div>
      </Panel>
      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col p-4">
          {error && <ErrorBanner message={error} />}
          {!error && !result && (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">Strips comments/editor metadata and rounds long decimals — run Optimize to see the result.</div>
          )}
          {result && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs text-ink-soft">
                  {formatBytes(result.originalBytes)} → {formatBytes(result.optimizedBytes)}
                  {savingsPct !== null && savingsPct > 0 && <span className="ml-2 text-emerald">-{savingsPct}%</span>}
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={result.svg} />
                  <Button variant="ghost" onClick={() => downloadText(result.svg, 'optimized.svg', 'image/svg+xml')}>
                    <DownloadSimple size={13} weight="light" /> .svg
                  </Button>
                </div>
              </div>
              <textarea
                readOnly
                value={result.svg}
                spellCheck={false}
                className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[12px] leading-relaxed text-ink outline-none"
              />
            </>
          )}
        </div>
      </Panel>
    </>
  )
}

function ConvertTab() {
  const [direction, setDirection] = useState<'svg-to-raster' | 'raster-to-svg'>('svg-to-raster')
  const [svgInput, setSvgInput] = useState(SAMPLE_SVG)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [scale, setScale] = useState(2)
  const [rasterFile, setRasterFile] = useState<File | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [resultText, setResultText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      if (direction === 'svg-to-raster') {
        const blob = await svgToRaster(svgInput, format, scale)
        if (resultUrl) URL.revokeObjectURL(resultUrl)
        setResultUrl(URL.createObjectURL(blob))
        setResultBlob(blob)
        setResultText(null)
      } else {
        if (!rasterFile) return
        const svg = await rasterToSvgWrapper(rasterFile)
        setResultText(svg)
        setResultUrl(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Convert failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex gap-1 rounded-xl border border-rule bg-panel p-1">
            <button
              onClick={() => setDirection('svg-to-raster')}
              className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium ${direction === 'svg-to-raster' ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
            >
              SVG → PNG/JPG
            </button>
            <button
              onClick={() => setDirection('raster-to-svg')}
              className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium ${direction === 'raster-to-svg' ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
            >
              Raster → SVG (embed)
            </button>
          </div>

          {direction === 'svg-to-raster' ? (
            <>
              <SectionLabel>SVG source</SectionLabel>
              <textarea
                value={svgInput}
                onChange={(e) => setSvgInput(e.target.value)}
                spellCheck={false}
                className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-cyan/50"
              />
              <div className="flex items-center gap-2">
                {(['png', 'jpeg'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium uppercase ${format === f ? 'bg-glass-strong text-ink' : 'bg-glass text-ink-faint hover:text-ink-soft'}`}
                  >
                    {f}
                  </button>
                ))}
                <label className="ml-auto flex items-center gap-2 text-[11px] text-ink-soft">
                  Scale
                  <input type="range" min={1} max={4} step={0.5} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="accent-cyan" />
                  <span className="font-mono text-ink-faint">{scale}×</span>
                </label>
              </div>
            </>
          ) : (
            <>
              <SectionLabel>Raster image</SectionLabel>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
                <UploadSimple size={14} weight="light" />
                <span className="truncate">{rasterFile ? rasterFile.name : 'Choose an image…'}</span>
                <input type="file" accept="image/*" onChange={(e) => setRasterFile(e.target.files?.[0] ?? null)} className="hidden" />
              </label>
              <div className="text-[10.5px] text-ink-faint">Wraps the raster in an SVG container (base64 embedded) — not a real vectorization. For that, use the Trace tab.</div>
            </>
          )}

          <Button variant="primary" onClick={run} disabled={loading || (direction === 'raster-to-svg' && !rasterFile)}>
            {loading ? 'Converting…' : 'Convert'}
          </Button>
        </div>
      </Panel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col p-4">
          {error && <ErrorBanner message={error} />}
          {!error && !resultUrl && !resultText && (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">Result appears here.</div>
          )}
          {resultUrl && (
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-rule bg-panel p-2">
                <img src={resultUrl} alt="result" className="max-h-full max-w-full object-contain" />
              </div>
              <Button variant="default" onClick={() => resultBlob && downloadBlob(resultBlob, `export.${format === 'jpeg' ? 'jpg' : 'png'}`)}>
                <DownloadSimple size={14} weight="light" /> Download
              </Button>
            </div>
          )}
          {resultText && (
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-rule bg-panel p-2">
                <img src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(resultText)))}`} alt="result" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-ink-faint">
                <span>{formatBytes(resultText.length)}</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={resultText} />
                  <Button variant="ghost" onClick={() => downloadText(resultText, 'wrapped.svg', 'image/svg+xml')}>
                    <DownloadSimple size={13} weight="light" /> .svg
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </>
  )
}

function EditorTab() {
  const [code, setCode] = useState(SAMPLE_SVG)
  const previewUrl = useMemo(() => {
    try {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(code)))}`
    } catch {
      return null
    }
  }, [code])

  return (
    <>
      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>Code</SectionLabel>
            <CopyButton text={code} />
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-cyan/50"
          />
        </div>
      </Panel>
      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col p-4">
          <SectionLabel>Live preview</SectionLabel>
          <div
            className="mt-2 flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-rule p-4"
            style={{ backgroundImage: 'repeating-conic-gradient(var(--panel) 0% 25%, var(--surface) 0% 50%)', backgroundSize: '16px 16px' }}
          >
            {previewUrl && <img src={previewUrl} alt="preview" className="max-h-full max-w-full object-contain" />}
          </div>
        </div>
      </Panel>
    </>
  )
}

function TraceTab() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [colors, setColors] = useState(6)
  const [maxDimension, setMaxDimension] = useState(96)
  const [result, setResult] = useState<{ svg: string; width: number; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function pick(f: File | null) {
    setFile(f)
    setResult(null)
    setError(null)
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setSourceUrl(f ? URL.createObjectURL(f) : null)
  }

  async function run() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      setResult(await traceImageToSvg(file, { colors, maxDimension }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trace failed')
    } finally {
      setLoading(false)
    }
  }

  const previewUrl = useMemo(() => {
    if (!result) return null
    try {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(result.svg)))}`
    } catch {
      return null
    }
  }, [result])

  return (
    <>
      <Panel className="flex flex-col overflow-hidden">
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>Image to trace</SectionLabel>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
            <UploadSimple size={14} weight="light" />
            <span className="truncate">{file ? file.name : 'Choose an image…'}</span>
            <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0] ?? null)} className="hidden" />
          </label>

          <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
            <div className="flex items-center justify-between">
              <span>Colors</span>
              <span className="font-mono text-ink-faint">{colors}</span>
            </div>
            <input type="range" min={2} max={24} value={colors} onChange={(e) => setColors(Number(e.target.value))} className="accent-cyan" />
          </label>

          <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
            <div className="flex items-center justify-between">
              <span>Detail (working resolution)</span>
              <span className="font-mono text-ink-faint">{maxDimension}px</span>
            </div>
            <input type="range" min={24} max={256} step={8} value={maxDimension} onChange={(e) => setMaxDimension(Number(e.target.value))} className="accent-cyan" />
          </label>

          <div className="text-[10.5px] text-ink-faint">
            Traces smooth curved outlines (contour tracing + Bezier fitting) around each flat color region, holes included —
            works best on flat-color logos/icons, not photos. Higher detail = more anchor points = larger file.
          </div>

          <Button variant="primary" onClick={run} disabled={!file || loading}>
            {loading ? 'Tracing…' : 'Trace'}
          </Button>

          {sourceUrl && (
            <>
              <SectionLabel>Original</SectionLabel>
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-rule bg-panel p-2">
                <img src={sourceUrl} alt="original" className="max-h-full max-w-full object-contain" />
              </div>
            </>
          )}
        </div>
      </Panel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col p-4">
          {error && <ErrorBanner message={error} />}
          {!error && !result && <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">Traced SVG appears here.</div>}
          {result && previewUrl && (
            <>
              <div
                className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-rule p-4"
                style={{ backgroundImage: 'repeating-conic-gradient(var(--panel) 0% 25%, var(--surface) 0% 50%)', backgroundSize: '16px 16px' }}
              >
                <img src={previewUrl} alt="traced" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
                <span>{formatBytes(result.svg.length)} · {result.width}×{result.height}</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={result.svg} />
                  <Button variant="ghost" onClick={() => downloadText(result.svg, 'traced.svg', 'image/svg+xml')}>
                    <DownloadSimple size={13} weight="light" /> .svg
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>
    </>
  )
}
