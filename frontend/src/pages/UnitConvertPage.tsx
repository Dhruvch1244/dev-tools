import { useMemo, useState } from 'react'
import { CopyButton, Field, Input, Panel, Segmented, SectionLabel, Select } from '../components/ui'

const SI = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
const IEC = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

function parseBytes(s: string): number | null {
  const m = /^\s*([\d.]+)\s*([kmgtp]?i?b?|bytes?)?\s*$/i.exec(s)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  const u = (m[2] ?? 'b').toLowerCase()
  if (u === 'b' || u.startsWith('byte') || u === '') return n
  const idx = 'kmgtp'.indexOf(u[0]) + 1
  const iec = u.includes('i') || u.length === 1 // "1G" / "512m" (JVM-style) are binary
  return n * (iec ? 1024 : 1000) ** idx
}

function parseDuration(s: string): number | null {
  const t = s.trim()
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t)
  const iso = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/i.exec(t)
  if (iso && t.length > 1) return ((+(iso[1] ?? 0) * 24 + +(iso[2] ?? 0)) * 60 + +(iso[3] ?? 0)) * 60000 + +(iso[4] ?? 0) * 1000
  let total = 0
  let any = false
  const re = /([\d.]+)\s*(ms|milliseconds?|s|sec|seconds?|m|min|minutes?|h|hr|hours?|d|days?|w|weeks?)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    any = true
    const n = Number(m[1])
    const u = m[2].toLowerCase()
    total += n * (u.startsWith('ms') || u.startsWith('milli') ? 1 : u.startsWith('s') ? 1000 : u.startsWith('m') ? 60000 : u.startsWith('h') ? 3600000 : u.startsWith('d') ? 86400000 : 604800000)
  }
  return any ? total : null
}

const human = (ms: number) => {
  const parts: string[] = []
  let r = Math.round(ms)
  for (const [u, n] of [['d', 86400000], ['h', 3600000], ['m', 60000], ['s', 1000]] as const) {
    if (r >= n) {
      parts.push(`${Math.floor(r / n)}${u}`)
      r %= n
    }
  }
  if (r || !parts.length) parts.push(`${r}ms`)
  return parts.join(' ')
}
const iso = (ms: number) => {
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = (ms % 60000) / 1000
  return `P${d ? d + 'D' : ''}T${h ? h + 'H' : ''}${m ? m + 'M' : ''}${s || (!d && !h && !m) ? s + 'S' : ''}`.replace(/T$/, '')
}
const fmt = (n: number) => (Math.abs(n) >= 1e6 || (n !== 0 && Math.abs(n) < 0.001) ? n.toExponential(3) : Number(n.toFixed(4)).toLocaleString())

function Row({ k, v }: { k: string; v: string }) {
return (
  <div className="flex items-center gap-3 rounded-xl bg-glass px-3 py-2 ring-1 ring-rule-soft">
    <span className="w-24 shrink-0 text-[0.8125rem] font-bold uppercase tracking-wider text-ink-faint">{k}</span>
    <span className="min-w-0 flex-1 break-all font-mono text-[1rem] text-ink">{v}</span>
    <CopyButton text={v} label="" />
  </div>
)
}

export function UnitConvertPage() {
  const [tab, setTab] = useState<'bytes' | 'time' | 'rate'>('bytes')
  const [bytesIn, setBytesIn] = useState('1.5 GiB')
  const [durIn, setDurIn] = useState('1h 30m 15s')
  const [size, setSize] = useState('40 GB')
  const [speed, setSpeed] = useState('100')
  const [speedUnit, setSpeedUnit] = useState('Mbps')
  const bytes = parseBytes(bytesIn)
  const ms = parseDuration(durIn)
  const transfer = useMemo(() => {
    const b = parseBytes(size)
    const v = Number(speed)
    if (b === null || !v) return null
    const bitsPerSec = v * ({ Kbps: 1e3, Mbps: 1e6, Gbps: 1e9, 'MB/s': 8e6, 'MiB/s': 8 * 1048576, 'GB/s': 8e9 } as Record<string, number>)[speedUnit]
    return (b * 8) / bitsPerSec * 1000
  }, [size, speed, speedUnit])

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <Segmented id="unit-tab" value={tab} onChange={setTab} options={[{ id: 'bytes', label: 'Data size' }, { id: 'time', label: 'Duration' }, { id: 'rate', label: 'Transfer time' }]} />
      {tab === 'bytes' && (
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <Field label="Size" hint="Examples: 1536, 2.5 GB, 512Mi, 4G (JVM -Xmx style = binary)"><Input value={bytesIn} onChange={(e) => setBytesIn(e.target.value)} className="!text-[1.25rem] font-mono" /></Field>
            {bytes === null ? <div className="text-rose">Can't read that size.</div> : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="flex flex-col gap-1.5"><SectionLabel>Decimal (SI, disks & network)</SectionLabel>{SI.map((u, i) => <Row key={u} k={u} v={fmt(bytes / 1000 ** i)} />)}</div>
                <div className="flex flex-col gap-1.5"><SectionLabel>Binary (IEC, RAM, k8s Mi/Gi)</SectionLabel>{IEC.map((u, i) => <Row key={u} k={u} v={fmt(bytes / 1024 ** i)} />)}<Row k="bits" v={fmt(bytes * 8)} /></div>
              </div>
            )}
          </div>
        </Panel>
      )}
      {tab === 'time' && (
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <Field label="Duration" hint="1h 30m · 90s · 2d4h · PT1H30M · 5400000 (ms)"><Input value={durIn} onChange={(e) => setDurIn(e.target.value)} className="!text-[1.25rem] font-mono" /></Field>
            {ms === null ? <div className="text-rose">Can't read that duration.</div> : (
              <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                <Row k="human" v={human(ms)} />
                <Row k="ISO-8601" v={iso(ms)} />
                <Row k="ms" v={fmt(ms)} />
                <Row k="seconds" v={fmt(ms / 1000)} />
                <Row k="minutes" v={fmt(ms / 60000)} />
                <Row k="hours" v={fmt(ms / 3600000)} />
                <Row k="days" v={fmt(ms / 86400000)} />
                <Row k="Spring" v={`${Math.round(ms / 1000)}s`} />
              </div>
            )}
          </div>
        </Panel>
      )}
      {tab === 'rate' && (
        <Panel>
          <div className="flex flex-col gap-3 p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="How much data"><Input value={size} onChange={(e) => setSize(e.target.value)} className="font-mono" /></Field>
              <Field label="Link speed"><Input value={speed} onChange={(e) => setSpeed(e.target.value)} className="font-mono" /></Field>
              <Field label="Unit"><Select value={speedUnit} onChange={(e) => setSpeedUnit(e.target.value)}>{['Kbps', 'Mbps', 'Gbps', 'MB/s', 'MiB/s', 'GB/s'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
            </div>
            {transfer !== null && (
              <div className="rounded-3xl bg-glass p-6 text-center ring-1 ring-rule-soft">
                <div className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-ink-faint">at full speed, no overhead</div>
                <div className="font-display gradient-text text-[3.4rem] leading-none">{human(transfer)}</div>
                <div className="text-[0.9375rem] text-ink-soft">≈ {human(transfer * 1.15)} with ~15% protocol overhead</div>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}
