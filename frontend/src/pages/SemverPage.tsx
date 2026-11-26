import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { bump, coerce, compare, describeRange, format, satisfies, type Bump } from '../lib/semver'
import { Badge, Field, Input, Panel, SectionLabel, TextArea, Toggle } from '../components/ui'

const BUMPS: Bump[] = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease']

export function SemverPage() {
  const [a, setA] = useState('1.4.57')
  const [b, setB] = useState('1.5.0-rc.2')
  const [preId, setPreId] = useState('rc')
  const [range, setRange] = useState('^1.4.0 || >=2.0.0 <2.1.0')
  const [list, setList] = useState('1.3.9\n1.4.0\n1.4.57\n1.5.0-rc.2\n1.9.3\n2.0.0\n2.0.5\n2.1.0\n3.0.0-beta.1')
  const [includePre, setIncludePre] = useState(false)

  const va = coerce(a)
  const vb = coerce(b)
  const cmp = va && vb ? compare(va, vb) : null
  const versions = useMemo(() => list.split(/[\s,]+/).filter(Boolean).map((s) => ({ raw: s, v: coerce(s) })), [list])
  const sorted = useMemo(() => [...versions].filter((x) => x.v).sort((x, y) => compare(x.v!, y.v!)), [versions])
  let rangeOk = true
  let matches: string[] = []
  try {
    matches = sorted.filter((x) => satisfies(x.v!, range, includePre)).map((x) => x.raw)
  } catch {
    rangeOk = false
  }
  const maxSat = matches.length ? matches[matches.length - 1] : null

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel>
          <div className="flex flex-col gap-4 p-5">
            <SectionLabel>Compare</SectionLabel>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <Field label="Version A"><Input value={a} onChange={(e) => setA(e.target.value)} className="font-mono" /></Field>
              <motion.div key={String(cmp)} initial={{ scale: 0.4, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} className="font-display pb-1 text-center text-[2.6rem] leading-none text-cyan">
                {cmp === null ? '?' : cmp > 0 ? '>' : cmp < 0 ? '<' : '='}
              </motion.div>
              <Field label="Version B"><Input value={b} onChange={(e) => setB(e.target.value)} className="font-mono" /></Field>
            </div>
            {(!va || !vb) && <div className="text-[0.875rem] text-rose">{!va ? `"${a}"` : `"${b}"`} isn't a valid version.</div>}
            {va && (
              <div className="flex flex-wrap gap-2 text-[0.875rem]">
                <Badge tone="cyan">major {va.major}</Badge><Badge tone="cyan">minor {va.minor}</Badge><Badge tone="cyan">patch {va.patch}</Badge>
                {va.pre.length > 0 && <Badge tone="warm">pre {va.pre.join('.')}</Badge>}
                {va.build.length > 0 && <Badge tone="violet">build {va.build.join('.')}</Badge>}
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-end gap-3">
              <SectionLabel>Bump version A</SectionLabel>
              <Field label="pre-id" className="ml-auto w-28"><Input value={preId} onChange={(e) => setPreId(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {va && BUMPS.map((k, i) => (
                <motion.button key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => setA(format(bump(va, k, preId)))} className="flex items-center justify-between gap-2 rounded-xl bg-glass px-3 py-2 text-left ring-1 ring-rule-soft transition-transform hover:-translate-y-0.5">
                  <span className="text-[0.875rem] font-semibold text-ink-soft">{k}</span>
                  <span className="font-mono text-[0.9375rem] text-ink">{format(bump(va, k, preId))}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </Panel>
      </div>
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <SectionLabel>Range check (npm / Maven-style ^ ~ x || hyphen)</SectionLabel>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Range" className="min-w-[18rem] flex-1"><Input value={range} onChange={(e) => setRange(e.target.value)} className="font-mono" /></Field>
            <Toggle checked={includePre} onChange={setIncludePre} label="Include prereleases" />
          </div>
          <div className="break-all font-mono text-[0.875rem] text-ink-faint">≡ {describeRange(range)}</div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[22rem_1fr]">
            <Field label="Versions (any separator)"><TextArea value={list} onChange={(e) => setList(e.target.value)} className="!flex-none h-52" /></Field>
            <div className="flex flex-col gap-1.5">
              <div className="text-[0.875rem] text-ink-soft">{rangeOk ? <>Highest satisfying: <b className="font-mono text-emerald">{maxSat ?? 'none'}</b></> : <span className="text-rose">Invalid range</span>}</div>
              <div className="flex flex-wrap gap-1.5">
                {sorted.map((x) => {
                  const ok = matches.includes(x.raw)
                  return (
                    <span key={x.raw} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-[0.875rem] ring-1 ${ok ? 'bg-emerald/10 text-emerald ring-emerald/40' : 'text-ink-faint ring-rule-soft'}`}>
                      {ok ? <CheckCircle size={13} weight="fill" /> : <XCircle size={13} />} {x.raw}
                    </span>
                  )
                })}
                {versions.filter((x) => !x.v).map((x) => <span key={x.raw} className="rounded-full px-3 py-1 font-mono text-[0.875rem] text-rose ring-1 ring-rose/40">{x.raw} ✗ invalid</span>)}
              </div>
              <div className="mt-2 text-[0.8125rem] text-ink-faint">Sorted: {sorted.map((x) => x.raw).join(' → ')}</div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
