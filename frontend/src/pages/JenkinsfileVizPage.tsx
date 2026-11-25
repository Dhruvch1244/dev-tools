import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, GitFork, HandPalm, Info, Warning, XCircle } from '@phosphor-icons/react'
import { parseJenkinsfile, SAMPLE_JENKINSFILE, type JStage } from '../lib/jenkinsfile'
import { Badge, Button, EmptyState, Panel, SectionLabel, StatTile, TextArea } from '../components/ui'

const LS = 'devtools.jenkinsfile.input'

export function JenkinsfileVizPage() {
  const [src, setSrc] = useState(() => localStorage.getItem(LS) ?? SAMPLE_JENKINSFILE)
  const model = useMemo(() => parseJenkinsfile(src), [src])
  const count = (s: JStage[]): number => s.reduce((n, x) => n + 1 + count(x.children), 0)
  const errors = model.findings.filter((f) => f.level === 'error').length
  const warns = model.findings.filter((f) => f.level === 'warn').length

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-xl:[&>*]:shrink-0 xl:flex-row xl:overflow-hidden">
      <Panel className="xl:w-[min(34rem,42%)] xl:shrink-0">
        <div className="flex h-full min-h-[24rem] flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Jenkinsfile</SectionLabel>
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => setSrc(SAMPLE_JENKINSFILE)}>Sample</Button>
              <Button variant="ghost" onClick={() => setSrc('')}>Clear</Button>
            </div>
          </div>
          <TextArea value={src} onChange={(e) => { setSrc(e.target.value); try { localStorage.setItem(LS, e.target.value) } catch { /* ignore */ } }} placeholder="pipeline { … }" />
        </div>
      </Panel>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:overflow-y-auto [&>*]:shrink-0">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Style" value={model.kind} tone="violet" />
          <StatTile label="Stages" value={count(model.stages)} />
          <StatTile label="Errors" value={errors} tone={errors ? 'rose' : 'emerald'} />
          <StatTile label="Warnings" value={warns} tone={warns ? 'warm' : 'emerald'} />
        </div>
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <SectionLabel>Pipeline flow</SectionLabel>
            {model.stages.length === 0 ? (
              <EmptyState title="No stages found">Paste a declarative or scripted Jenkinsfile with stage('…') blocks.</EmptyState>
            ) : (
              <div className="flex flex-wrap items-stretch gap-2">
                {model.stages.map((s, i) => (
                  <div key={s.start} className="flex items-center gap-2">
                    <StageCard s={s} i={i} />
                    {i < model.stages.length - 1 && <ArrowRight size={20} className="shrink-0 text-ink-faint" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-2 p-5">
            <SectionLabel>Findings</SectionLabel>
            {model.findings.length === 0 && <div className="text-[0.9375rem] text-emerald">Nothing to flag. Nice pipeline.</div>}
            {model.findings.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className={`flex gap-3 rounded-2xl px-4 py-3 ring-1 ${f.level === 'error' ? 'bg-rose/[0.07] ring-rose/30' : f.level === 'warn' ? 'bg-warm/[0.07] ring-warm/30' : 'bg-glass ring-rule-soft'}`}>
                {f.level === 'error' ? <XCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-rose" /> : f.level === 'warn' ? <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-warm" /> : <Info size={18} weight="fill" className="mt-0.5 shrink-0 text-cyan" />}
                <div className="min-w-0 text-[0.9375rem] text-ink-soft"><span className="mr-2 font-mono text-[0.8125rem] text-ink-faint">L{f.line}</span>{f.message}</div>
              </motion.div>
            ))}
          </div>
        </Panel>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Panel>
            <div className="flex flex-col gap-2 p-5">
              <SectionLabel>Parameters</SectionLabel>
              {model.parameters.length === 0 ? <div className="text-ink-faint">none</div> : model.parameters.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-[0.9375rem]"><Badge tone="cyan">{p.type}</Badge><span className="font-mono text-ink">{p.name}</span></div>
              ))}
              {model.libraries.length > 0 && <><SectionLabel>Shared libraries</SectionLabel>{model.libraries.map((l) => <div key={l} className="font-mono text-ink-soft">{l}</div>)}</>}
            </div>
          </Panel>
          <Panel>
            <div className="flex flex-col gap-2 p-5">
              <SectionLabel>Agent · options · environment</SectionLabel>
              {model.agent && <div className="font-mono text-[0.875rem] text-ink-soft">agent {model.agent}</div>}
              {model.options.map((o) => <div key={o} className="break-all font-mono text-[0.875rem] text-ink-soft">{o}</div>)}
              {model.environment.map((e) => <div key={e} className="break-all font-mono text-[0.875rem] text-violet">{e}</div>)}
              {model.triggers.map((t) => <div key={t} className="break-all font-mono text-[0.875rem] text-warm">trigger {t}</div>)}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function StageCard({ s, i }: { s: JStage; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.06 }}
      className={`flex min-w-[11rem] max-w-[22rem] flex-col gap-2 rounded-2xl p-3 ring-1 ${s.hasInput ? 'bg-warm/[0.08] ring-warm/50' : s.parallel ? 'bg-violet/[0.07] ring-violet/40' : 'bg-glass ring-rule'}`}
    >
      <div className="flex items-center gap-2">
        {s.parallel ? <GitFork size={17} weight="bold" className="text-violet" /> : s.hasInput ? <HandPalm size={17} weight="fill" className="text-warm" /> : <span className="h-2.5 w-2.5 rounded-full bg-cyan" />}
        <span className="text-[1rem] font-semibold text-ink">{s.name}</span>
        <span className="ml-auto font-mono text-[0.75rem] text-ink-faint">L{s.line}</span>
      </div>
      {s.when && <div className="break-all rounded-lg bg-glass px-2 py-1 font-mono text-[0.75rem] text-ink-soft">when {s.when}</div>}
      {s.hasInput && <div className="text-[0.8125rem] text-warm">⏸ {s.inputMessage ?? 'input'}</div>}
      {s.timeout && <div className="text-[0.75rem] text-ink-faint">timeout {s.timeout}</div>}
      {s.steps.length > 0 && <div className="flex flex-wrap gap-1">{s.steps.map((st, k) => <span key={k} className="rounded-md bg-glass px-1.5 py-0.5 font-mono text-[0.75rem] text-ink-soft">{st}</span>)}</div>}
      {s.children.length > 0 && (
        <div className={`flex gap-2 ${s.parallel ? 'flex-col' : 'flex-col'}`}>
          {s.children.map((c, k) => (
            <div key={c.start} className="flex flex-col items-stretch gap-1">
              {!s.parallel && k > 0 && <ArrowDown size={14} className="mx-auto text-ink-faint" />}
              <StageCard s={c} i={k} />
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
