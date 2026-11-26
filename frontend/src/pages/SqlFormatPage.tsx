import { useMemo, useState } from 'react'
import { formatSql, minifySql } from '../lib/sqlFormat'
import { CodeOut, Field, Panel, Segmented, SectionLabel, TextArea, Toggle } from '../components/ui'

const SAMPLE = `select o.id, o.status, c.name, sum(l.qty * l.price) total from orders o join customers c on c.id = o.customer_id left join order_lines l on l.order_id = o.id where o.created_at >= date '2026-01-01' and (o.status = 'OPEN' or o.status = 'HOLD') and c.id in (select customer_id from vip) group by o.id, o.status, c.name having sum(l.qty * l.price) > 1000 order by total desc fetch first 50 rows only;`

export function SqlFormatPage() {
  const [src, setSrc] = useState(SAMPLE)
  const [mode, setMode] = useState<'pretty' | 'minify'>('pretty')
  const [indent, setIndent] = useState<'2' | '4'>('2')
  const [upper, setUpper] = useState(true)
  const [commaFirst, setCommaFirst] = useState(false)
  const out = useMemo(() => {
    try {
      return mode === 'minify' ? minifySql(src) : formatSql(src, { indent: Number(indent), uppercase: upper, commaFirst, linesBetweenStatements: 1 })
    } catch (e) {
      return `-- could not format: ${e instanceof Error ? e.message : e}`
    }
  }, [src, mode, indent, upper, commaFirst])
  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-xl:[&>*]:shrink-0 xl:flex-row xl:overflow-hidden">
      <Panel className="xl:w-[40%] xl:shrink-0">
        <div className="flex h-full min-h-[22rem] flex-col gap-3 p-4">
          <SectionLabel>SQL in</SectionLabel>
          <TextArea value={src} onChange={(e) => setSrc(e.target.value)} placeholder="select …" />
        </div>
      </Panel>
      <Panel className="min-w-0 flex-1">
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-5 [&>*]:shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented id="sql-mode" value={mode} onChange={setMode} options={[{ id: 'pretty', label: 'Pretty' }, { id: 'minify', label: 'Minify' }]} />
            {mode === 'pretty' && (
              <>
                <Field label="Indent"><Segmented id="sql-indent" size="sm" value={indent} onChange={setIndent} options={[{ id: '2', label: '2' }, { id: '4', label: '4' }]} /></Field>
                <Toggle checked={upper} onChange={setUpper} label="UPPERCASE keywords" />
                <Toggle checked={commaFirst} onChange={setCommaFirst} label="Leading commas" />
              </>
            )}
          </div>
          <CodeOut text={out} label={mode === 'pretty' ? 'Formatted' : 'Minified'} />
        </div>
      </Panel>
    </div>
  )
}
