import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { convertHinglish, type HinglishConvertResult } from '../api'
import { Button, CopyButton, ErrorBanner, Panel, SectionLabel, TextArea } from '../components/ui'
import { HistoryPanel } from '../components/HistoryPanel'
import { ResizablePanel } from '../components/ResizablePanel'

export function HinglishConverterPage() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<HinglishConvertResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  async function run() {
    setError(null)
    try {
      setResult(await convertHinglish(input))
      setRefreshKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="hinglish-convert" className="flex flex-col gap-4">
        <Panel>
          <div className="p-4">
            <p className="mb-3 text-xs leading-relaxed text-ink-soft">
              Paste Hinglish or any romanized Indian-language text — Tanglish (Tamil), Tenglish
              (Telugu), Kannada, Malayalam, Hindi, Punjabi, Marathi, Gujarati, Bengali — and get
              plain English plus a Hindi (Devanagari) rendering. Dictionary-based and offline: it
              recognizes common words/phrases and leaves the rest as-is. Coverage leans South —
              Tamil/Telugu/Kannada/Malayalam have denser word lists than the North Indian
              languages.
            </p>
            <Button variant="primary" className="w-full" onClick={run} disabled={!input}>
              Convert
            </Button>
          </div>
        </Panel>
        <Panel>
          <div className="p-4">
            <HistoryPanel tool="hinglish-convert" refreshKey={refreshKey} onReuse={setInput} />
          </div>
        </Panel>
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-auto">
        <div className="flex h-full flex-col gap-4 p-4">
          <div>
            <SectionLabel>Romanized input</SectionLabel>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={'enna panra machan?\nem chestunnav ra?\nkaise ho yaar?'}
              className="!flex-none h-28"
            />
          </div>

          <AnimatePresence mode="wait">{error && <ErrorBanner message={error} key="err" />}</AnimatePresence>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4"
              >
                {result.detectedLanguages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {result.detectedLanguages.map((l) => (
                      <span
                        key={l.language}
                        className="rounded-full bg-glass-strong px-2.5 py-1 text-[10.5px] font-medium"
                        style={{ color: l.south ? 'var(--emerald)' : 'var(--cyan)' }}
                      >
                        {l.language} · {l.count}
                      </span>
                    ))}
                    <span className="text-[10.5px] text-ink-faint">
                      {result.recognizedCount}/{result.totalWords} words recognized
                    </span>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <SectionLabel>Plain English</SectionLabel>
                    <CopyButton text={result.plainEnglish} />
                  </div>
                  <pre className="whitespace-pre-wrap rounded-2xl border border-rule bg-panel p-4 font-mono text-[13px] text-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                    {result.plainEnglish}
                  </pre>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <SectionLabel>Hindi (हिंदी)</SectionLabel>
                    <CopyButton text={result.hindi} />
                  </div>
                  <pre className="whitespace-pre-wrap rounded-2xl border border-rule bg-panel p-4 font-mono text-[13px] text-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                    {result.hindi}
                  </pre>
                </div>

                {result.breakdown.length > 0 && (
                  <div>
                    <SectionLabel>Word / phrase breakdown</SectionLabel>
                    <div className="overflow-hidden rounded-2xl border border-rule">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-glass text-[10.5px] uppercase tracking-wide text-ink-faint">
                            <th className="px-3 py-2 font-medium">Original</th>
                            <th className="px-3 py-2 font-medium">Language</th>
                            <th className="px-3 py-2 font-medium">English</th>
                            <th className="px-3 py-2 font-medium">Hindi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.breakdown.map((w, i) => (
                            <tr key={i} className="border-t border-rule-soft">
                              <td className="px-3 py-2 font-mono text-ink">{w.original}</td>
                              <td className="px-3 py-2">
                                <span style={{ color: w.south ? 'var(--emerald)' : 'var(--cyan)' }}>{w.language}</span>
                              </td>
                              <td className="px-3 py-2 text-ink-soft">{w.english}</td>
                              <td className="px-3 py-2 text-ink-soft">{w.hindi}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Panel>
    </div>
  )
}
