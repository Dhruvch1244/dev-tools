import { useState } from 'react'
import { UploadSimple } from '@phosphor-icons/react'
import { linePct, parseJacocoXml, type JacocoReport } from '../lib/jacoco'
import { Panel, ErrorBanner, Button } from '../components/ui'

const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE report PUBLIC "-//JACOCO//DTD Report 1.1//EN" "report.dtd">
<report name="devtools-suite">
  <package name="com/dhruv/devtools/vault">
    <class name="com/dhruv/devtools/vault/VaultService">
      <counter type="INSTRUCTION" missed="12" covered="188"/>
      <counter type="BRANCH" missed="2" covered="18"/>
      <counter type="LINE" missed="4" covered="61"/>
    </class>
    <class name="com/dhruv/devtools/vault/VaultController">
      <counter type="INSTRUCTION" missed="60" covered="40"/>
      <counter type="BRANCH" missed="6" covered="2"/>
      <counter type="LINE" missed="22" covered="9"/>
    </class>
    <counter type="LINE" missed="26" covered="70"/>
  </package>
  <package name="com/dhruv/devtools/plsql">
    <class name="com/dhruv/devtools/plsql/PlSqlAnalyzerService">
      <counter type="INSTRUCTION" missed="240" covered="60"/>
      <counter type="BRANCH" missed="40" covered="8"/>
      <counter type="LINE" missed="88" covered="20"/>
    </class>
    <counter type="LINE" missed="88" covered="20"/>
  </package>
  <counter type="LINE" missed="114" covered="90"/>
</report>
`

function pctColor(p: number | null): string {
  if (p === null) return 'bg-ink-faint/40'
  if (p >= 80) return 'bg-emerald/60'
  if (p >= 50) return 'bg-warm/60'
  return 'bg-rose/60'
}

export function JacocoViewerPage() {
  const [report, setReport] = useState<JacocoReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load(text: string) {
    try {
      setError(null)
      setReport(parseJacocoXml(text))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse this file')
      setReport(null)
    }
  }

  async function handleFile(file: File) {
    load(await file.text())
  }

  const overall = report ? linePct({ lineCovered: report.totalLineCovered, lineMissed: report.totalLineMissed }) : null
  const sorted = report ? [...report.classes].sort((a, b) => (linePct(a) ?? 100) - (linePct(b) ?? 100)) : []

  return (
    <div className="flex h-full flex-col gap-4">
      <Panel>
        <div className="flex items-center gap-3 p-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-rule px-3 py-2.5 text-xs text-ink-soft transition-colors hover:border-cyan/40 hover:text-ink">
            <UploadSimple size={14} weight="light" />
            Load a JaCoCo report.xml (mvn jacoco:report / gradle jacocoTestReport)
            <input type="file" accept=".xml" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
          <Button variant="ghost" onClick={() => load(SAMPLE)}>Try a sample</Button>
          {report && overall !== null && (
            <div className="text-xs text-ink-soft">
              {report.classes.length} classes · <span className={overall >= 80 ? 'text-emerald' : overall >= 50 ? 'text-warm' : 'text-rose'}>{overall.toFixed(1)}% line coverage</span> overall
            </div>
          )}
        </div>
      </Panel>

      {error && <ErrorBanner message={error} />}

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {sorted.length === 0 && !error ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">Load a jacoco.xml to see coverage, worst-covered classes first.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sorted.map((c, i) => {
                const p = linePct(c)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-96 shrink-0 truncate font-mono text-[11.5px] text-ink-soft" title={`${c.packageName}.${c.className}`}>
                      <span className="text-ink-faint">{c.packageName}.</span>
                      {c.className}
                    </span>
                    <div className="relative h-4 flex-1 rounded bg-glass">
                      <div className={`absolute top-0 h-4 rounded ${pctColor(p)}`} style={{ width: `${p ?? 0}%` }} />
                    </div>
                    <span className="w-32 shrink-0 text-right font-mono text-[11.5px] text-ink-faint">
                      {p === null ? 'no lines' : `${p.toFixed(1)}% (${c.lineCovered}/${c.lineCovered + c.lineMissed})`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
