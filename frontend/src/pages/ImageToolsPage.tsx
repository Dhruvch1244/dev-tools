import { useState } from 'react'
import { UploadSimple, DownloadSimple, Image as ImageIcon, Eyedropper } from '@phosphor-icons/react'
import { convertImage, convertImageBatch, enhanceImage, enhanceImageBatch, removeColor, type ImageFormat } from '../lib/mediaApi'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

type Tab = 'convert' | 'enhance' | 'remove-bg'

export function ImageToolsPage() {
  const [tab, setTab] = useState<Tab>('convert')
  const [files, setFiles] = useState<File[]>([])
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultName, setResultName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [format, setFormat] = useState<ImageFormat>('png')
  const [brightness, setBrightness] = useState(1)
  const [contrast, setContrast] = useState(1)
  const [sharpen, setSharpen] = useState(false)
  const [scale, setScale] = useState(1)

  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgTolerance, setBgTolerance] = useState(20)
  const [bgEdgesOnly, setBgEdgesOnly] = useState(true)

  async function pickColorFromScreen() {
    // EyeDropper API — Chromium-only, feature-detected, no fallback needed since the hex input still works.
    const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropperCtor) return
    try {
      const result = await new EyeDropperCtor().open()
      setBgColor(result.sRGBHex)
    } catch {
      /* user cancelled the picker */
    }
  }

  const isBatch = files.length > 1
  const singleFile = files.length === 1 ? files[0] : null

  function pickFiles(list: File[]) {
    setFiles(list)
    setResultUrl(null)
    setError(null)
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setSourceUrl(list.length === 1 ? URL.createObjectURL(list[0]) : null)
  }

  async function run() {
    if (files.length === 0) return
    if (tab === 'remove-bg' && isBatch) return
    setLoading(true)
    setError(null)
    try {
      const { blob, fileName } =
        tab === 'remove-bg'
          ? await removeColor(files[0], bgColor, bgTolerance, bgEdgesOnly)
          : isBatch
            ? tab === 'convert'
              ? await convertImageBatch(files, format)
              : await enhanceImageBatch(files, { brightness, contrast, sharpen, scale })
            : tab === 'convert'
              ? await convertImage(files[0], format)
              : await enhanceImage(files[0], { brightness, contrast, sharpen, scale })
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setResultUrl(URL.createObjectURL(blob))
      setResultName(fileName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="image-tools" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3 p-4">
            <div className="mb-1 flex gap-1 rounded-xl border border-rule bg-panel p-1">
              {(['convert', 'enhance', 'remove-bg'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
                    tab === t ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'
                  }`}
                >
                  {t === 'remove-bg' ? 'Remove BG' : t === 'convert' ? 'Convert' : 'Enhance'}
                </button>
              ))}
            </div>

            <SectionLabel>Image{isBatch ? 's' : ''}</SectionLabel>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
              <UploadSimple size={14} weight="light" />
              <span className="truncate">
                {files.length === 0 ? 'Choose one or more images…' : files.length === 1 ? files[0].name : `${files.length} images selected`}
              </span>
              <input
                type="file"
                accept="image/*,.webp"
                multiple
                onChange={(e) => pickFiles(Array.from(e.target.files ?? []))}
                className="hidden"
              />
            </label>
            {isBatch && (
              <div className="text-[11px] text-ink-faint">Multiple images selected — result downloads as a zip instead of a side-by-side preview.</div>
            )}

            {tab === 'convert' ? (
              <>
                <SectionLabel>Target format</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {(['png', 'jpg', 'bmp', 'gif', 'webp'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium uppercase transition-colors ${
                        format === f ? 'bg-glass-strong text-ink' : 'bg-glass text-ink-faint hover:text-ink-soft'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </>
            ) : tab === 'enhance' ? (
              <>
                <Slider label="Brightness" value={brightness} min={0.3} max={2} step={0.05} onChange={setBrightness} format={(v) => `${Math.round(v * 100)}%`} />
                <Slider label="Contrast" value={contrast} min={0.3} max={2} step={0.05} onChange={setContrast} format={(v) => `${Math.round(v * 100)}%`} />
                <Slider label="Scale" value={scale} min={0.25} max={4} step={0.25} onChange={setScale} format={(v) => `${v}×`} />
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input type="checkbox" checked={sharpen} onChange={(e) => setSharpen(e.target.checked)} className="accent-cyan" />
                  Sharpen
                </label>
              </>
            ) : (
              <>
                <SectionLabel>Color to remove</SectionLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-rule bg-transparent p-0.5"
                  />
                  <input
                    className="devtools-input flex-1 font-mono"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                  />
                  {'EyeDropper' in window && (
                    <button
                      onClick={pickColorFromScreen}
                      title="Pick a color from the image"
                      className="shrink-0 rounded-lg border border-rule p-2 text-ink-faint hover:border-cyan/40 hover:text-ink"
                    >
                      <Eyedropper size={14} weight="light" />
                    </button>
                  )}
                </div>
                <Slider label="Tolerance" value={bgTolerance} min={1} max={80} step={1} onChange={setBgTolerance} format={(v) => `${v}%`} />
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input type="checkbox" checked={bgEdgesOnly} onChange={(e) => setBgEdgesOnly(e.target.checked)} className="accent-cyan" />
                  Only remove connected background (safer — won't punch holes in the subject)
                </label>
                {isBatch && <div className="text-[11px] text-warm">Pick a single image for background removal — batch isn't supported here.</div>}
              </>
            )}

            <Button variant="primary" onClick={run} disabled={files.length === 0 || loading || (tab === 'remove-bg' && isBatch)}>
              {loading
                ? 'Processing…'
                : tab === 'remove-bg'
                  ? 'Remove background'
                  : isBatch
                    ? `${tab === 'convert' ? 'Convert' : 'Enhance'} ${files.length} images`
                    : tab === 'convert'
                      ? 'Convert'
                      : 'Enhance'}
            </Button>
          </div>
        </Panel>
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {error && <ErrorBanner message={error} />}

          {files.length === 0 && !error && (
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">
              <div className="flex flex-col items-center gap-2">
                <ImageIcon size={28} weight="light" />
                Pick one or more images on the left to get started.
              </div>
            </div>
          )}

          {isBatch && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="flex max-h-40 w-72 flex-col gap-1 overflow-auto rounded-2xl border border-rule bg-panel p-3">
                {files.map((f, i) => (
                  <div key={i} className="truncate text-[11px] text-ink-soft">{f.name}</div>
                ))}
              </div>
              {resultUrl ? (
                <Button variant="default" onClick={() => downloadResult(resultUrl, resultName)}>
                  <DownloadSimple size={14} weight="light" /> Download {resultName}
                </Button>
              ) : (
                <span className="text-xs text-ink-faint">Run {tab} to process all {files.length} images into a zip.</span>
              )}
            </div>
          )}

          {singleFile && (
            <div className="grid h-full grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <SectionLabel>Original</SectionLabel>
                <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-rule bg-panel p-2">
                  {sourceUrl && <img src={sourceUrl} alt="original" className="max-h-full max-w-full object-contain" />}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <SectionLabel>Result</SectionLabel>
                <div
                  className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-rule p-2"
                  style={
                    tab === 'remove-bg'
                      ? {
                          backgroundImage:
                            'repeating-conic-gradient(var(--panel) 0% 25%, var(--surface) 0% 50%)',
                          backgroundSize: '16px 16px',
                        }
                      : undefined
                  }
                >
                  {resultUrl ? (
                    <img src={resultUrl} alt="result" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-ink-faint">Run {tab === 'remove-bg' ? 'Remove background' : tab} to see the output here.</span>
                  )}
                </div>
                {resultUrl && (
                  <Button variant="default" onClick={() => downloadResult(resultUrl, resultName)}>
                    <DownloadSimple size={14} weight="light" /> Download {resultName}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

function downloadResult(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format: (v: number) => string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] text-ink-soft">
        <span>{label}</span>
        <span className="font-mono text-ink-faint">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan"
      />
    </div>
  )
}
