import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { contains, intToIp, ipToInt, overlaps, parseCidr, rangeToCidrs, split, toBinary, withScope } from '../lib/cidr'
import { Badge, CopyButton, Field, Input, Panel, SectionLabel, StatTile, TextArea } from '../components/ui'

export function CidrPage() {
  const [input, setInput] = useState('10.20.0.0/20')
  const [splitTo, setSplitTo] = useState(24)
  const [probe, setProbe] = useState('10.20.7.42')
  const [list, setList] = useState('10.0.0.0/16\n10.0.128.0/17\n10.1.0.0/16\n192.168.0.0/24\n192.168.0.128/25')
  const [rangeA, setRangeA] = useState('10.0.0.1')
  const [rangeB, setRangeB] = useState('10.0.0.130')

  const c = useMemo(() => {
    const p = parseCidr(input)
    return p ? withScope(p) : null
  }, [input])
  const subnets = useMemo(() => (c ? split(c, splitTo) : []), [c, splitTo])
  const probeIp = ipToInt(probe)
  const blocks = useMemo(() => list.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ l, c: parseCidr(l) })), [list])
  const conflicts = useMemo(() => {
    const out: [string, string][] = []
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) if (blocks[i].c && blocks[j].c && overlaps(blocks[i].c!, blocks[j].c!)) out.push([blocks[i].l, blocks[j].l])
    return out
  }, [blocks])
  const ra = ipToInt(rangeA)
  const rb = ipToInt(rangeB)
  const cover = ra !== null && rb !== null && ra <= rb ? rangeToCidrs(ra, rb) : []

  const rows: [string, string][] = c
    ? [
        ['Network', `${intToIp(c.network)}/${c.prefix}`],
        ['Netmask', intToIp(c.mask)],
        ['Wildcard', intToIp(c.wildcard)],
        ['Broadcast', intToIp(c.broadcast)],
        ['First host', intToIp(c.firstHost)],
        ['Last host', intToIp(c.lastHost)],
        ['Class', c.klass],
        ['Scope', c.scope],
      ]
    : []

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <Panel>
        <div className="flex flex-col gap-4 p-5">
          <Field label="CIDR, IP + mask, or a single IP" hint="10.0.0.0/16 · 192.168.1.10 255.255.255.0 · 172.16.4.2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} className="!text-[1.25rem] font-mono" />
          </Field>
          {!c ? <div className="text-rose">Not a valid IPv4 CIDR.</div> : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile label="Prefix" value={`/${c.prefix}`} />
                <StatTile label="Total addresses" value={c.total.toLocaleString()} tone="violet" />
                <StatTile label="Usable hosts" value={c.usable.toLocaleString()} tone="emerald" />
                <StatTile label="Scope" value={c.scope.split(' ')[0]} tone="warm" hint={c.scope} />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2 rounded-xl bg-glass px-3 py-2 ring-1 ring-rule-soft">
                    <span className="text-[0.8125rem] font-bold uppercase tracking-wider text-ink-faint">{k}</span>
                    <span className="flex items-center gap-1 font-mono text-[0.9375rem] text-ink">{v}<CopyButton text={v} label="" /></span>
                  </div>
                ))}
              </div>
              <div>
                <SectionLabel>Bits — network vs host</SectionLabel>
                <div className="flex flex-wrap gap-[3px] font-mono">
                  {toBinary(c.ip).replace(/\./g, '').split('').map((b, i) => (
                    <motion.span key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.012 }} className={`grid h-8 w-6 place-items-center rounded-md text-[0.875rem] font-bold ${i < c.prefix ? 'bg-cyan/20 text-cyan' : 'bg-violet/15 text-violet'} ${i % 8 === 7 && i < 31 ? 'mr-2' : ''}`}>
                      {b}
                    </motion.span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <SectionLabel>Split into subnets</SectionLabel>
              <Field label="New prefix" className="ml-auto w-32">
                <Input type="number" min={c?.prefix ?? 0} max={32} value={splitTo} onChange={(e) => setSplitTo(Number(e.target.value))} />
              </Field>
            </div>
            {c && splitTo >= c.prefix && <div className="text-[0.875rem] text-ink-faint">{(2 ** (splitTo - c.prefix)).toLocaleString()} × /{splitTo} ({(2 ** (32 - splitTo)).toLocaleString()} addresses each){2 ** (splitTo - c.prefix) > 256 ? ' — showing first 256' : ''}</div>}
            <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {subnets.map((s) => <div key={s.network} className="rounded-lg bg-glass px-3 py-1.5 font-mono text-[0.875rem] text-ink-soft">{intToIp(s.network)}/{s.prefix} <span className="text-ink-faint">→ {intToIp(s.broadcast)}</span></div>)}
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <SectionLabel>Does it contain this IP?</SectionLabel>
            <Input value={probe} onChange={(e) => setProbe(e.target.value)} className="font-mono" />
            {c && probeIp !== null && (
              <motion.div key={String(contains(c, probeIp))} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-2xl px-4 py-3 text-[1.0625rem] font-semibold ${contains(c, probeIp) ? 'bg-emerald/10 text-emerald' : 'bg-rose/10 text-rose'}`}>
                {probe} is {contains(c, probeIp) ? 'inside' : 'outside'} {intToIp(c.network)}/{c.prefix}
              </motion.div>
            )}
            <SectionLabel>IP range → CIDR blocks</SectionLabel>
            <div className="flex gap-2"><Input value={rangeA} onChange={(e) => setRangeA(e.target.value)} className="font-mono" /><Input value={rangeB} onChange={(e) => setRangeB(e.target.value)} className="font-mono" /></div>
            <div className="flex flex-wrap gap-1.5">{cover.map((x) => <Badge key={x} tone="cyan">{x}</Badge>)}</div>
          </div>
        </Panel>
      </div>
      <Panel>
        <div className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-[24rem_1fr]">
          <Field label="Overlap check — one CIDR per line (VPCs, subnets, firewall rules)"><TextArea value={list} onChange={(e) => setList(e.target.value)} className="!flex-none h-44" /></Field>
          <div className="flex flex-col gap-1.5">
            {blocks.filter((b) => !b.c).map((b) => <div key={b.l} className="text-rose">✗ {b.l} is not valid</div>)}
            {conflicts.length === 0 ? <div className="text-emerald">No overlaps 🎉</div> : conflicts.map(([x, y]) => <div key={x + y} className="rounded-xl bg-warm/10 px-3 py-2 font-mono text-[0.9375rem] text-warm">{x} ⟷ {y} overlap</div>)}
          </div>
        </div>
      </Panel>
    </div>
  )
}
