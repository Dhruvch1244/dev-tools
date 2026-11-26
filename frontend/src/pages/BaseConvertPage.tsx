import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CopyButton, Field, Input, Panel, Segmented, SectionLabel } from '../components/ui'

const BASES = [
  { id: 2, label: 'Binary', prefix: '0b' },
  { id: 8, label: 'Octal', prefix: '0o' },
  { id: 10, label: 'Decimal', prefix: '' },
  { id: 16, label: 'Hex', prefix: '0x' },
  { id: 36, label: 'Base36', prefix: '' },
]
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

function parseBig(s: string, base: number): bigint | null {
  let t = s.trim().toLowerCase().replace(/[_\s,]/g, '')
  let neg = false
  if (t.startsWith('-')) {
    neg = true
    t = t.slice(1)
  }
  if (base === 16) t = t.replace(/^0x/, '')
  if (base === 2) t = t.replace(/^0b/, '')
  if (base === 8) t = t.replace(/^0o/, '')
  if (!t) return null
  let v = 0n
  for (const ch of t) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= base) return null
    v = v * BigInt(base) + BigInt(d)
  }
  return neg ? -v : v
}

const toStr = (v: bigint, base: number) => (v < 0n ? '-' + (-v).toString(base) : v.toString(base))

export function BaseConvertPage() {
  const [value, setValue] = useState('48879')
  const [base, setBase] = useState(10)
  const [width, setWidth] = useState<'8' | '16' | '32' | '64'>('32')
  const [other, setOther] = useState('0xFF00')
  const v = useMemo(() => parseBig(value, base), [value, base])
  const o = useMemo(() => parseBig(other.replace(/^0x/i, ''), other.trim().toLowerCase().startsWith('0x') ? 16 : other.trim().toLowerCase().startsWith('0b') ? 2 : 10), [other])
  const w = BigInt(width)
  const mask = (1n << w) - 1n
  const unsigned = v === null ? null : ((v % (1n << w)) + (1n << w)) & mask
  const signed = unsigned === null ? null : unsigned >= 1n << (w - 1n) ? unsigned - (1n << w) : unsigned
  const bits = unsigned === null ? [] : unsigned.toString(2).padStart(Number(w), '0').split('')

  function flip(i: number) {
    if (unsigned === null) return
    const bit = 1n << BigInt(bits.length - 1 - i)
    const next = unsigned ^ bit
    setValue(toStr(next, base))
  }

  const ops: [string, bigint | null][] = v !== null && o !== null && unsigned !== null ? [
    ['A AND B', (unsigned & o) & mask],
    ['A OR B', (unsigned | o) & mask],
    ['A XOR B', (unsigned ^ o) & mask],
    ['NOT A', ~unsigned & mask],
    ['A << 1', (unsigned << 1n) & mask],
    ['A >> 1', unsigned >> 1n],
    ['A + B', v + o],
    ['A − B', v - o],
  ] : []

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <Panel>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Value" className="min-w-[16rem] flex-1"><Input value={value} onChange={(e) => setValue(e.target.value)} className="!text-[1.25rem] font-mono" /></Field>
            <Field label="Input base"><Segmented id="base-in" value={String(base)} onChange={(b) => { if (v !== null) setValue(toStr(v, Number(b))); setBase(Number(b)) }} options={BASES.map((b) => ({ id: String(b.id), label: b.label }))} /></Field>
          </div>
          {v === null ? <div className="text-rose">Not a valid base-{base} number.</div> : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
              {BASES.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl bg-glass px-3 py-2.5 ring-1 ring-rule-soft">
                  <span className="w-20 shrink-0 text-[0.8125rem] font-bold uppercase tracking-wider text-ink-faint">{b.label}</span>
                  <span className="min-w-0 flex-1 break-all font-mono text-[1rem] text-ink">{b.prefix}{toStr(v, b.id)}</span>
                  <CopyButton text={b.prefix + toStr(v, b.id)} label="" />
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <SectionLabel>Bits (click to flip)</SectionLabel>
            <Segmented id="bit-width" size="sm" value={width} onChange={setWidth} options={[{ id: '8', label: '8-bit' }, { id: '16', label: '16' }, { id: '32', label: '32' }, { id: '64', label: '64' }]} />
            {signed !== null && <span className="text-[0.9375rem] text-ink-soft">unsigned <b className="font-mono text-ink">{unsigned!.toString()}</b> · signed (two's complement) <b className="font-mono text-ink">{signed.toString()}</b></span>}
          </div>
          <div className="flex flex-wrap gap-[3px]">
            {bits.map((b, i) => (
              <motion.button key={`${width}-${i}`} whileTap={{ scale: 0.8 }} onClick={() => flip(i)} title={`bit ${bits.length - 1 - i}`} className={`grid h-9 w-7 place-items-center rounded-md font-mono text-[0.875rem] font-bold transition-colors ${b === '1' ? 'bg-cyan text-[var(--on-accent)]' : 'bg-glass text-ink-faint'} ${(i + 1) % 8 === 0 && i < bits.length - 1 ? 'mr-2' : ''}`}>
                {b}
              </motion.button>
            ))}
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <SectionLabel>Bitwise with B</SectionLabel>
            <Field label="B (0x…, 0b…, or decimal)" className="w-64"><Input value={other} onChange={(e) => setOther(e.target.value)} className="font-mono" /></Field>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ops.map(([k, r]) => r !== null && (
              <div key={k} className="flex items-center gap-3 rounded-xl bg-glass px-3 py-2">
                <span className="w-20 shrink-0 font-mono text-[0.875rem] text-violet">{k}</span>
                <span className="font-mono text-ink">{r.toString()}</span>
                <span className="font-mono text-ink-faint">0x{toStr(r, 16)}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}
