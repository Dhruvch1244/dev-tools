import { useState } from 'react'
import { UploadSimple, DownloadSimple, FilePdf, X, CaretUp, CaretDown } from '@phosphor-icons/react'
import { imagesToPdf, pdfToImages, mergePdfs, splitPdf, triggerDownload } from '../lib/mediaApi'
import { Button, Panel, SectionLabel, ErrorBanner } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

type Tab = 'to-pdf' | 'from-pdf' | 'merge' | 'split'

const TABS: { id: Tab; label: string }[] = [
  { id: 'to-pdf', label: 'Images → PDF' },
  { id: 'from-pdf', label: 'PDF → Images' },
  { id: 'merge', label: 'Merge PDFs' },
  { id: 'split', label: 'Split PDF' },
]

export function PdfToolsPage() {
  const [tab, setTab] = useState<Tab>('to-pdf')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultName, setResultName] = useState('')

  const [images, setImages] = useState<File[]>([])

  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [outFormat, setOutFormat] = useState<'png' | 'jpg'>('png')
  const [dpi, setDpi] = useState(150)

  const [mergeFiles, setMergeFiles] = useState<File[]>([])
  const [splitFile, setSplitFile] = useState<File | null>(null)

  function clearResult() {
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setResultUrl(null)
  }

  function switchTab(t: Tab) {
    setTab(t)
    clearResult()
    setError(null)
  }

  async function runImagesToPdf() {
    if (images.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const { blob, fileName } = await imagesToPdf(images)
      clearResult()
      setResultUrl(URL.createObjectURL(blob))
      setResultName(fileName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
    } finally {
      setLoading(false)
    }
  }

  async function runPdfToImages() {
    if (!pdfFile) return
    setLoading(true)
    setError(null)
    try {
      const { blob, fileName } = await pdfToImages(pdfFile, outFormat, dpi)
      clearResult()
      setResultUrl(URL.createObjectURL(blob))
      setResultName(fileName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
    } finally {
      setLoading(false)
    }
  }

  async function runMerge() {
    if (mergeFiles.length < 2) return
    setLoading(true)
    setError(null)
    try {
      const { blob, fileName } = await mergePdfs(mergeFiles)
      clearResult()
      setResultUrl(URL.createObjectURL(blob))
      setResultName(fileName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed')
    } finally {
      setLoading(false)
    }
  }

  async function runSplit() {
    if (!splitFile) return
    setLoading(true)
    setError(null)
    try {
      const { blob, fileName } = await splitPdf(splitFile)
      clearResult()
      setResultUrl(URL.createObjectURL(blob))
      setResultName(fileName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Split failed')
    } finally {
      setLoading(false)
    }
  }

  function moveMergeFile(i: number, dir: -1 | 1) {
    setMergeFiles((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="pdf-tools" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-3 p-4">
            <div className="mb-1 grid grid-cols-2 gap-1 rounded-xl border border-rule bg-panel p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`rounded-lg py-1.5 text-[11px] font-medium transition-colors ${tab === t.id ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:text-ink-soft'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'to-pdf' && (
              <>
                <SectionLabel>Images (one page each, in order)</SectionLabel>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
                  <UploadSimple size={14} weight="light" />
                  <span className="truncate">{images.length ? `${images.length} image(s) selected` : 'Choose images…'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => setImages(Array.from(e.target.files ?? []))}
                    className="hidden"
                  />
                </label>
                {images.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {images.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-lg bg-glass px-2 py-1 text-[11px] text-ink-soft">
                        <span className="flex-1 truncate">{i + 1}. {f.name}</span>
                        <button onClick={() => setImages((prev) => prev.filter((_, pi) => pi !== i))} className="text-ink-faint hover:text-rose">
                          <X size={11} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="primary" onClick={runImagesToPdf} disabled={images.length === 0 || loading}>
                  {loading ? 'Building…' : 'Build PDF'}
                </Button>
              </>
            )}

            {tab === 'from-pdf' && (
              <>
                <SectionLabel>PDF file</SectionLabel>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
                  <UploadSimple size={14} weight="light" />
                  <span className="truncate">{pdfFile ? pdfFile.name : 'Choose a PDF…'}</span>
                  <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} className="hidden" />
                </label>

                <SectionLabel>Output format</SectionLabel>
                <div className="flex gap-1.5">
                  {(['png', 'jpg'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setOutFormat(f)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium uppercase transition-colors ${
                        outFormat === f ? 'bg-glass-strong text-ink' : 'bg-glass text-ink-faint hover:text-ink-soft'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] text-ink-soft">
                    <span>DPI</span>
                    <span className="font-mono text-ink-faint">{dpi}</span>
                  </div>
                  <input type="range" min={72} max={300} step={12} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="w-full accent-cyan" />
                </div>

                <Button variant="primary" onClick={runPdfToImages} disabled={!pdfFile || loading}>
                  {loading ? 'Rendering…' : 'Render pages'}
                </Button>
              </>
            )}

            {tab === 'merge' && (
              <>
                <SectionLabel>PDFs to merge, in order</SectionLabel>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
                  <UploadSimple size={14} weight="light" />
                  <span className="truncate">{mergeFiles.length ? `${mergeFiles.length} PDF(s) selected` : 'Choose PDFs…'}</span>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={(e) => setMergeFiles(Array.from(e.target.files ?? []))}
                    className="hidden"
                  />
                </label>
                {mergeFiles.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {mergeFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-lg bg-glass px-2 py-1 text-[11px] text-ink-soft">
                        <span className="flex-1 truncate">{i + 1}. {f.name}</span>
                        <button onClick={() => moveMergeFile(i, -1)} disabled={i === 0} className="text-ink-faint hover:text-cyan disabled:opacity-30">
                          <CaretUp size={11} weight="bold" />
                        </button>
                        <button onClick={() => moveMergeFile(i, 1)} disabled={i === mergeFiles.length - 1} className="text-ink-faint hover:text-cyan disabled:opacity-30">
                          <CaretDown size={11} weight="bold" />
                        </button>
                        <button onClick={() => setMergeFiles((prev) => prev.filter((_, pi) => pi !== i))} className="text-ink-faint hover:text-rose">
                          <X size={11} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="primary" onClick={runMerge} disabled={mergeFiles.length < 2 || loading}>
                  {loading ? 'Merging…' : 'Merge PDFs'}
                </Button>
              </>
            )}

            {tab === 'split' && (
              <>
                <SectionLabel>PDF to split (one file per page)</SectionLabel>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
                  <UploadSimple size={14} weight="light" />
                  <span className="truncate">{splitFile ? splitFile.name : 'Choose a PDF…'}</span>
                  <input type="file" accept="application/pdf" onChange={(e) => setSplitFile(e.target.files?.[0] ?? null)} className="hidden" />
                </label>
                <Button variant="primary" onClick={runSplit} disabled={!splitFile || loading}>
                  {loading ? 'Splitting…' : 'Split PDF'}
                </Button>
              </>
            )}
          </div>
        </Panel>
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 p-4">
          {error && (
            <div className="flex flex-1 items-center justify-center">
              <ErrorBanner message={error} />
            </div>
          )}
          {!error && !resultUrl && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-ink-faint">
              <FilePdf size={28} weight="light" />
              {tab === 'to-pdf' && 'Pick images and build a PDF.'}
              {tab === 'from-pdf' && 'Pick a PDF and render its pages to images.'}
              {tab === 'merge' && 'Pick two or more PDFs to merge, in order.'}
              {tab === 'split' && 'Pick a multi-page PDF to split into one file per page.'}
            </div>
          )}
          {resultUrl && !error && (
            <>
              {tab === 'to-pdf' || tab === 'merge' ? (
                <iframe src={resultUrl} title="PDF preview" className="w-full flex-1 rounded-2xl border border-rule bg-white" />
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-rule bg-panel text-sm text-ink-soft">
                  {tab === 'split' ? 'Pages split — download the zip below.' : 'Pages rendered — download the zip below.'}
                </div>
              )}
              <Button
                variant="default"
                onClick={() => {
                  fetch(resultUrl)
                    .then((r) => r.blob())
                    .then((b) => triggerDownload(b, resultName))
                }}
                className="self-center"
              >
                <DownloadSimple size={14} weight="light" /> Download {resultName}
              </Button>
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}
