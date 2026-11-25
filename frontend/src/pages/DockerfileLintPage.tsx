import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { lintDockerfile, SAMPLE_DOCKERFILE } from '../lib/dockerfileLint'
import { Badge, Button, Panel, SectionLabel, TextArea } from '../components/ui'
import { FindingRow, Score } from './LintParts'

const LS = 'devtools.dockerfile.input'

export function DockerfileLintPage() {
  const [src, setSrc] = useState(() => localStorage.getItem(LS) ?? SAMPLE_DOCKERFILE)
  const res = useMemo(() => lintDockerfile(src), [src])
  const errors = res.findings.filter((f) => f.level === 'error').length
  const warns = res.findings.filter((f) => f.level === 'warn').length
  const byLine = new Map<number, number>()
  res.findings.forEach((f) => byLine.set(f.line, Math.max(byLine.get(f.line) ?? 0, f.level === 'error' ? 3 : f.level === 'warn' ? 2 : 1)))

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-xl:[&>*]:shrink-0 xl:flex-row xl:overflow-hidden">
      <Panel className="xl:w-[min(34rem,42%)] xl:shrink-0">
        <div className="flex h-full min-h-[24rem] flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Dockerfile</SectionLabel>
            <div className="flex gap-1"><Button variant="ghost" onClick={() => setSrc(SAMPLE_DOCKERFILE)}>Sample</Button><Button variant="ghost" onClick={() => setSrc('')}>Clear</Button></div>
          </div>
          <TextArea value={src} onChange={(e) => { setSrc(e.target.value); try { localStorage.setItem(LS, e.target.value) } catch { /* ignore */ } }} placeholder="FROM eclipse-temurin:21-jre" />
        </div>
      </Panel>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:overflow-y-auto [&>*]:shrink-0">
        <Panel>
          <div className="flex flex-wrap items-center gap-6 p-5">
            <Score errors={errors} warns={warns} />
            <div className="flex flex-wrap gap-2">
              <Badge tone="violet">{res.stages.length} stage{res.stages.length === 1 ? '' : 's'}</Badge>
              <Badge tone="rose">{errors} errors</Badge>
              <Badge tone="warm">{warns} warnings</Badge>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <SectionLabel>Build stages</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {res.stages.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="min-w-[16rem] flex-1 rounded-2xl bg-glass p-3 ring-1 ring-rule-soft">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-display text-[1.4rem] text-cyan">{s.name ?? `stage ${i}`}</span>
                    <span className="break-all font-mono text-[0.8125rem] text-ink-faint">{s.base}</span>
                  </div>
                  {s.instructions.map((ins) => {
                    const sev = byLine.get(ins.line)
                    return (
                      <div key={ins.line} className={`flex gap-2 rounded-lg px-2 py-0.5 font-mono text-[0.8125rem] ${sev === 3 ? 'bg-rose/10' : sev === 2 ? 'bg-warm/10' : ''}`}>
                        <span className="w-6 shrink-0 text-right text-ink-faint">{ins.line}</span>
                        <span className="shrink-0 font-bold text-violet">{ins.cmd}</span>
                        <span className="min-w-0 truncate text-ink-soft" title={ins.args}>{ins.args}</span>
                      </div>
                    )
                  })}
                </motion.div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-2 p-5">
            <SectionLabel>Findings</SectionLabel>
            {res.findings.length === 0 && <div className="text-emerald">Clean! Nothing to flag.</div>}
            {res.findings.map((f, i) => <FindingRow key={i} i={i} level={f.level} where={`L${f.line} ${f.rule}`} message={f.message} />)}
          </div>
        </Panel>
      </div>
    </div>
  )
}
