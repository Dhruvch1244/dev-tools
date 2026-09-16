import { useEffect, useMemo, useState } from 'react'
import { describeCron, nextRuns, parseCron } from '../lib/cron'
import { CITY_TIMEZONES, isDaytimeAtLongitude, project, worldLandPath } from '../lib/worldMap'
import { Panel, SectionLabel, Button, ErrorBanner, CopyButton } from '../components/ui'

const MAP_W = 720
const MAP_H = 360

function WorldClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const worldPath = useMemo(() => worldLandPath(MAP_W, MAP_H), [])

  const rows = useMemo(
    () =>
      CITY_TIMEZONES.map((c) => {
        const day = isDaytimeAtLongitude(now, c.lon)
        const time = new Intl.DateTimeFormat('en-US', { timeStyle: 'medium', timeZone: c.tz }).format(now)
        const date = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: c.tz }).format(now)
        const offsetParts = new Intl.DateTimeFormat('en-US', { timeZone: c.tz, timeZoneName: 'shortOffset' }).formatToParts(now)
        const offset = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? ''
        return { ...c, day, time, date, offset }
      }),
    [now]
  )

  return (
    <Panel className="col-span-2">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <SectionLabel>World clock</SectionLabel>
          <span className="text-[10.5px] text-ink-faint">updates live</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-rule">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-auto w-full">
            {/* ocean base */}
            <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="color-mix(in srgb, var(--cyan) 10%, var(--panel))" />

            {/* graticule: a lon/lat reference grid every 30°, like a real map projection */}
            {Array.from({ length: 11 }, (_, i) => {
              const x = project(-180 + i * 30, 0, MAP_W, MAP_H).x
              return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={MAP_H} stroke="var(--rule-soft)" strokeWidth={1} />
            })}
            {Array.from({ length: 5 }, (_, i) => {
              const y = project(0, -60 + i * 30, MAP_W, MAP_H).y
              return <line key={`h${i}`} x1={0} y1={y} x2={MAP_W} y2={y} stroke="var(--rule-soft)" strokeWidth={1} />
            })}

            {/* landmasses — real coastlines (Natural Earth 110m via world-atlas + d3-geo), not hand-drawn shapes */}
            <path
              d={worldPath}
              fill="color-mix(in srgb, var(--emerald) 55%, var(--panel))"
              stroke="color-mix(in srgb, var(--emerald) 80%, var(--ink))"
              strokeWidth={0.75}
              strokeLinejoin="round"
            />

            {/* night-side shading, one thin vertical strip per few degrees of longitude */}
            {Array.from({ length: 72 }, (_, i) => {
              const lon = -180 + i * 5
              const day = isDaytimeAtLongitude(now, lon)
              const x = project(lon, 0, MAP_W, MAP_H).x
              const stripW = MAP_W / 72
              return day ? null : <rect key={i} x={x} y={0} width={stripW + 0.5} height={MAP_H} fill="var(--void)" opacity={0.4} />
            })}

            {rows.map((c, i) => {
              const { x, y } = project(c.lon, c.lat, MAP_W, MAP_H)
              const above = i % 2 === 0
              const labelY = above ? y - 8 : y + 14
              return (
                <g key={c.tz}>
                  <circle cx={x} cy={y} r={4} fill={c.day ? 'var(--warm)' : 'var(--cyan)'} stroke="var(--surface)" strokeWidth={1.5} />
                  <text x={x} y={labelY} fontSize={9} textAnchor="middle" fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" className="select-none">{c.city}</text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-rule">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-rule-soft text-[10px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Timezone</th>
                <th className="px-3 py-2 font-medium">Local time</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">UTC offset</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.tz} className="border-b border-rule-soft last:border-0">
                  <td className="px-3 py-1.5 text-ink">{c.city}</td>
                  <td className="px-3 py-1.5 font-mono text-ink-faint">{c.tz}</td>
                  <td className="px-3 py-1.5 font-mono text-ink">
                    <span className="mr-1.5">{c.day ? '☀️' : '🌙'}</span>{c.time}
                  </td>
                  <td className="px-3 py-1.5 text-ink-soft">{c.date}</td>
                  <td className="px-3 py-1.5 font-mono text-ink-faint">{c.offset}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  )
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CRON_PRESETS = [
  { label: 'Every minute', expr: '* * * * *' },
  { label: 'Every 15 min', expr: '*/15 * * * *' },
  { label: 'Hourly', expr: '0 * * * *' },
  { label: 'Daily at 2am', expr: '0 2 * * *' },
  { label: 'Weekdays at 9am', expr: '0 9 * * 1-5' },
  { label: 'Weekly (Sun midnight)', expr: '0 0 * * 0' },
  { label: 'Monthly (1st, midnight)', expr: '0 0 1 * *' },
]

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London',
  'Europe/Berlin', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
]

function offsetMinutesAt(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour === 24 ? 0 : +map.hour, +map.minute, +map.second)
  return (asUtc - utcMs) / 60000
}

/** Converts a wall-clock date/time as observed in `timeZone` into the real UTC instant it represents. */
function zonedWallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  let guess = Date.UTC(y, mo - 1, d, h, mi, 0)
  for (let i = 0; i < 2; i++) {
    const offset = offsetMinutesAt(guess, timeZone)
    guess = Date.UTC(y, mo - 1, d, h, mi, 0) - offset * 60000
  }
  return new Date(guess)
}

function AnyTimeConverter() {
  const now = new Date()
  const [sourceTz, setSourceTz] = useState('Asia/Kolkata')
  const [dateStr, setDateStr] = useState(now.toISOString().slice(0, 10))
  const [timeStr, setTimeStr] = useState(now.toTimeString().slice(0, 5))

  const instant = useMemo(() => {
    const [y, mo, d] = dateStr.split('-').map(Number)
    const [h, mi] = timeStr.split(':').map(Number)
    if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return null
    try {
      return zonedWallTimeToUtc(y, mo, d, h, mi, sourceTz)
    } catch {
      return null
    }
  }, [dateStr, timeStr, sourceTz])

  const relative = useMemo(() => {
    if (!instant) return ''
    const diffMs = instant.getTime() - Date.now()
    const abs = Math.abs(diffMs)
    const mins = Math.round(abs / 60000)
    const label =
      mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`
    return diffMs >= 0 ? `in ${label}` : `${label} ago`
  }, [instant])

  return (
    <Panel className="col-span-2">
      <div className="flex flex-col gap-3 p-4">
        <SectionLabel>Convert any date & time (any timezone) → everything</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" className="devtools-input w-auto" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          <input type="time" className="devtools-input w-auto" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
          <span className="text-xs text-ink-faint">in</span>
          <select className="devtools-input w-auto" value={sourceTz} onChange={(e) => setSourceTz(e.target.value)}>
            {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <Button
            variant="ghost"
            onClick={() => {
              const n = new Date()
              setDateStr(n.toISOString().slice(0, 10))
              setTimeStr(n.toTimeString().slice(0, 5))
              setSourceTz('Asia/Kolkata')
            }}
          >
            Now (IST)
          </Button>
        </div>

        {!instant ? (
          <ErrorBanner message="Enter a valid date and time." />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rule-soft bg-glass p-3 text-xs text-ink-soft">
              <span className="font-mono text-ink">{instant.toISOString()}</span>
              <span>· epoch {Math.floor(instant.getTime() / 1000)}s</span>
              <span>· {instant.getTime()}ms</span>
              <span>· {relative}</span>
              <CopyButton text={String(Math.floor(instant.getTime() / 1000))} label="Copy epoch" />
              <CopyButton text={instant.toISOString()} label="Copy ISO" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {TIMEZONES.map((z) => (
                <div key={z} className="flex flex-col rounded-lg bg-glass px-2.5 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-ink-faint">{z}</span>
                  <span className="font-mono text-[12px] text-ink">
                    {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: z }).format(instant)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}

export function TimeToolkitPage() {
  const [epoch, setEpoch] = useState(String(Math.floor(Date.now() / 1000)))
  const [iso, setIso] = useState(new Date().toISOString())
  const [tz, setTz] = useState('UTC')

  const [durFrom, setDurFrom] = useState(new Date(Date.now() - 3600_000).toISOString())
  const [durTo, setDurTo] = useState(new Date().toISOString())

  const [cronExpr, setCronExpr] = useState('*/15 * * * *')

  const epochDate = useMemo(() => {
    const n = Number(epoch)
    if (Number.isNaN(n)) return null
    return new Date(n > 1e12 ? n : n * 1000)
  }, [epoch])

  const isoDate = useMemo(() => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }, [iso])

  const zoned = useMemo(() => {
    const d = isoDate ?? epochDate
    if (!d) return null
    try {
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'long', timeZone: tz }).format(d)
    } catch {
      return null
    }
  }, [isoDate, epochDate, tz])

  const durationMs = useMemo(() => {
    const a = new Date(durFrom).getTime()
    const b = new Date(durTo).getTime()
    return Number.isNaN(a) || Number.isNaN(b) ? null : b - a
  }, [durFrom, durTo])

  const cron = useMemo(() => {
    try {
      const spec = parseCron(cronExpr)
      const grid: boolean[][] = Array.from({ length: 7 }, () => Array(24).fill(false))
      for (let d = 0; d < 7; d++) {
        if (!spec.dow.match(d)) continue
        for (let h = 0; h < 24; h++) {
          if (!spec.hour.match(h)) continue
          let active = false
          for (let m = 0; m < 60 && !active; m++) {
            if (spec.minute.match(m)) active = true
          }
          grid[d][h] = active
        }
      }
      return { description: describeCron(cronExpr), runs: nextRuns(cronExpr, 12), heatmap: grid, error: null as string | null }
    } catch (e) {
      return { description: '', runs: [], heatmap: null, error: e instanceof Error ? e.message : 'Invalid cron expression' }
    }
  }, [cronExpr])

  return (
    <div className="grid h-full grid-cols-2 gap-4 overflow-auto">
      <AnyTimeConverter />
      <WorldClock />

      <Panel>
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>Epoch ↔ ISO</SectionLabel>
          <label className="flex flex-col gap-1.5 text-xs text-ink-soft">
            Epoch (seconds or ms)
            <input className="devtools-input font-mono" value={epoch} onChange={(e) => setEpoch(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-ink-soft">
            ISO 8601
            <input className="devtools-input font-mono" value={iso} onChange={(e) => setIso(e.target.value)} />
          </label>
          <Button variant="ghost" onClick={() => setIso(epochDate ? epochDate.toISOString() : iso)}>
            Epoch → ISO
          </Button>
          <Button variant="ghost" onClick={() => setEpoch(isoDate ? String(Math.floor(isoDate.getTime() / 1000)) : epoch)}>
            ISO → Epoch
          </Button>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>Timezone view</SectionLabel>
          <select className="devtools-input" value={tz} onChange={(e) => setTz(e.target.value)}>
            {TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <div className="rounded-xl border border-rule-soft bg-glass p-3 text-sm text-ink">
            {zoned ?? 'Enter a valid epoch or ISO value above'}
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>Duration between two timestamps</SectionLabel>
          <input className="devtools-input font-mono" value={durFrom} onChange={(e) => setDurFrom(e.target.value)} />
          <input className="devtools-input font-mono" value={durTo} onChange={(e) => setDurTo(e.target.value)} />
          <div className="rounded-xl border border-rule-soft bg-glass p-3 text-sm text-ink">
            {durationMs == null ? 'Invalid timestamps' : formatDuration(durationMs)}
          </div>
        </div>
      </Panel>

      <Panel className="col-span-2">
        <div className="flex flex-col gap-3 p-4">
          <SectionLabel>Cron explainer</SectionLabel>
          <div className="flex items-center gap-2">
            <input
              className="devtools-input flex-1 font-mono"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="0 9 * * 1-5"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CRON_PRESETS.map((p) => (
              <button
                key={p.expr}
                onClick={() => setCronExpr(p.expr)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                  cronExpr === p.expr ? 'bg-glass-strong text-ink' : 'bg-glass text-ink-faint hover:text-ink-soft'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {cron.error ? (
            <ErrorBanner message={cron.error} />
          ) : (
            <>
              <div className="text-sm text-ink-soft">{cron.description}</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SectionLabel>Weekly pattern (ignoring day-of-month/month)</SectionLabel>
                  <div className="overflow-x-auto rounded-2xl border border-rule bg-panel p-3">
                    <div className="flex gap-1">
                      <div className="flex w-10 shrink-0 flex-col justify-end gap-[3px] pt-[18px]">
                        {DAY_LABELS.map((d) => (
                          <div key={d} className="flex h-[14px] items-center text-[9px] text-ink-faint">{d}</div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-[3px]">
                        <div className="flex gap-[3px]">
                          {Array.from({ length: 24 }, (_, h) => (
                            <div key={h} className="w-[14px] shrink-0 text-center text-[8px] text-ink-faint">{h % 3 === 0 ? h : ''}</div>
                          ))}
                        </div>
                        {cron.heatmap!.map((row, d) => (
                          <div key={d} className="flex gap-[3px]">
                            {row.map((active, h) => (
                              <div
                                key={h}
                                title={`${DAY_LABELS[d]} ${h}:00`}
                                className="h-[14px] w-[14px] shrink-0 rounded-sm"
                                style={{ background: active ? 'var(--cyan)' : 'var(--glass)' }}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <SectionLabel>Next 12 runs</SectionLabel>
                    <CopyButton text={cron.runs.map((r) => r.toLocaleString()).join('\n')} />
                  </div>
                  <div className="max-h-48 overflow-auto">
                    {cron.runs.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 border-l-2 border-rule-soft py-1.5 pl-3 text-xs">
                        <span className="-ml-[19px] h-2 w-2 shrink-0 rounded-full bg-cyan" />
                        <span className="text-ink">{r.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <span className="font-mono text-ink-soft">{r.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                        {i > 0 && <span className="text-ink-faint">+{Math.round((r.getTime() - cron.runs[i - 1].getTime()) / 60000)}m</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}

function formatDuration(ms: number): string {
  const sign = ms < 0 ? '-' : ''
  const abs = Math.abs(ms)
  const s = Math.floor(abs / 1000) % 60
  const m = Math.floor(abs / 60_000) % 60
  const h = Math.floor(abs / 3_600_000) % 24
  const d = Math.floor(abs / 86_400_000)
  return `${sign}${d}d ${h}h ${m}m ${s}s  (${abs.toLocaleString()} ms)`
}
