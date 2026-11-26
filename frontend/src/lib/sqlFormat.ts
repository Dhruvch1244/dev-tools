/** A pragmatic SQL pretty-printer: clause-per-line, indented select lists, AND/OR breaks, nested subqueries. */

export type SqlFormatOptions = { indent: number; uppercase: boolean; commaFirst: boolean; linesBetweenStatements: number }

type T = { k: 'word' | 'str' | 'num' | 'op' | 'comma' | 'lp' | 'rp' | 'semi' | 'comment' | 'ws' | 'dot'; v: string }

const KEYWORDS = new Set(
  ('select from where and or not in is null like between exists group by order having limit offset fetch first next rows only ' +
    'join inner left right full outer cross natural on using as distinct union all intersect except minus insert into values ' +
    'update set delete merge when matched then else end case create table view index alter drop add column primary key foreign references ' +
    'default constraint unique check with recursive over partition window asc desc nulls last returning begin commit rollback grant revoke ' +
    'truncate replace if declare cursor for loop return function procedure package body is exception raise lateral top interval true false any some')
    .split(' '),
)

const NEWLINE_BEFORE = [
  'select', 'from', 'where', 'group by', 'order by', 'having', 'limit', 'offset', 'fetch', 'union', 'union all', 'intersect', 'except', 'minus',
  'insert into', 'values', 'update', 'set', 'delete from', 'delete', 'returning', 'window', 'merge into', 'when matched', 'when not matched', 'with',
  'join', 'inner join', 'left join', 'left outer join', 'right join', 'right outer join', 'full join', 'full outer join', 'cross join', 'natural join', 'lateral',
]

function tokenize(sql: string): T[] {
  const out: T[] = []
  let i = 0
  while (i < sql.length) {
    const r = sql.slice(i)
    let m: RegExpExecArray | null
    if ((m = /^\s+/.exec(r))) out.push({ k: 'ws', v: m[0] })
    else if ((m = /^--[^\n]*/.exec(r)) || (m = /^\/\*[\s\S]*?\*\//.exec(r))) out.push({ k: 'comment', v: m[0] })
    else if ((m = /^'(?:''|[^'])*'/.exec(r)) || (m = /^"(?:""|[^"])*"/.exec(r)) || (m = /^`[^`]*`/.exec(r)) || (m = /^\[[^\]]*\]/.exec(r))) out.push({ k: 'str', v: m[0] })
    else if ((m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(r))) out.push({ k: 'num', v: m[0] })
    else if ((m = /^[A-Za-z_][\w$#]*/.exec(r))) out.push({ k: 'word', v: m[0] })
    else if ((m = /^[:@?$][\w]*/.exec(r))) out.push({ k: 'word', v: m[0] })
    else if (r[0] === ',') out.push({ k: 'comma', v: ',' })
    else if (r[0] === '(') out.push({ k: 'lp', v: '(' })
    else if (r[0] === ')') out.push({ k: 'rp', v: ')' })
    else if (r[0] === ';') out.push({ k: 'semi', v: ';' })
    else if (r[0] === '.') out.push({ k: 'dot', v: '.' })
    else if ((m = /^(<>|!=|<=|>=|\|\||::|=>|:=|[-+*/%=<>|&^~])/.exec(r))) out.push({ k: 'op', v: m[0] })
    else out.push({ k: 'op', v: r[0] })
    i += out[out.length - 1].v.length
  }
  return out
}

export function formatSql(sql: string, opts: SqlFormatOptions): string {
  const toks = tokenize(sql).filter((t) => t.k !== 'ws')
  const ind = ' '.repeat(opts.indent)
  const lines: string[] = []
  let line = ''
  let depth = 0
  const stack: { subquery: boolean; base: number }[] = []
  let clause = ''
  let betweenPending = false

  const kw = (v: string) => (opts.uppercase ? v.toUpperCase() : v.toLowerCase())
  const flush = () => {
    if (line.trim()) lines.push(line.replace(/\s+$/, ''))
    line = ''
  }
  const nl = (extra = 0) => {
    flush()
    line = ind.repeat(Math.max(0, depth + extra))
  }
  const push = (s: string, space = true) => {
    if (space && line.trim() && !/[(.]$/.test(line) && !line.endsWith(' ')) line += ' '
    line += s
  }

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const lower = t.v.toLowerCase()
    if (t.k === 'word' && KEYWORDS.has(lower)) {
      // combine multi-word keywords
      let phrase = lower
      let j = i
      for (const len of [3, 2]) {
        const cand = toks.slice(i, i + len)
        if (cand.length === len && cand.every((x) => x.k === 'word')) {
          const p = cand.map((x) => x.v.toLowerCase()).join(' ')
          if (NEWLINE_BEFORE.includes(p) || ['group by', 'order by', 'partition by', 'is not', 'not null', 'is null', 'primary key', 'nulls last', 'nulls first'].includes(p)) {
            phrase = p
            j = i + len - 1
            break
          }
        }
      }
      if (NEWLINE_BEFORE.includes(phrase)) {
        nl()
        push(kw(phrase), false)
        clause = phrase
        if (['select', 'set', 'values', 'group by', 'order by', 'returning'].includes(phrase) || phrase.startsWith('select')) {
          if (toks[j + 1] && toks[j + 1].v.toLowerCase() === 'distinct') {
            push(kw('distinct'))
            j++
          }
          nl(1)
        } else if (['from', 'where', 'having'].includes(phrase)) nl(1)
        i = j
        continue
      }
      if ((lower === 'and' || lower === 'or') && !betweenPending && ['where', 'having', 'on', 'when matched', 'join'].some((c) => clause.includes(c) || clause === c)) {
        nl(1)
        push(kw(lower), false)
        i = j
        continue
      }
      if (lower === 'on' && clause.includes('join')) {
        nl(1)
        push(kw('on'), false)
        clause = 'on'
        continue
      }
      if (lower === 'between') betweenPending = true
      else if (lower === 'and' && betweenPending) betweenPending = false
      if (lower === 'case') {
        push(kw('case'))
        depth++
        continue
      }
      if (lower === 'when' && !NEWLINE_BEFORE.includes(phrase)) {
        nl(1)
        push(kw('when'), false)
        continue
      }
      if (lower === 'else') {
        nl(1)
        push(kw('else'), false)
        continue
      }
      if (lower === 'end') {
        depth = Math.max(0, depth - 1)
        nl(1)
        push(kw('end'), false)
        continue
      }
      push(i === j ? kw(lower) : kw(phrase))
      i = j
      continue
    }
    switch (t.k) {
      case 'comma':
        if (depth > 0 && stack.length && !stack[stack.length - 1].subquery) {
          line += ','
        } else if (['select', 'set', 'values', 'group by', 'order by', 'returning'].some((c) => clause.startsWith(c)) || stack.length === 0) {
          if (opts.commaFirst) {
            nl(1)
            line += ', '
          } else {
            line += ','
            nl(1)
          }
        } else line += ','
        break
      case 'lp': {
        const nextWord = toks[i + 1]?.v.toLowerCase()
        const subquery = nextWord === 'select' || nextWord === 'with'
        push('(', !(toks[i - 1]?.k === 'word' && !KEYWORDS.has(toks[i - 1].v.toLowerCase())))
        stack.push({ subquery, base: depth })
        depth++
        if (subquery) nl()
        break
      }
      case 'rp': {
        const s = stack.pop()
        depth = s ? s.base : Math.max(0, depth - 1)
        if (s?.subquery) {
          nl()
          line += ')'
        } else line = line.replace(/\s+$/, '') + ')'
        break
      }
      case 'semi':
        line = line.replace(/\s+$/, '') + ';'
        flush()
        for (let k = 0; k < opts.linesBetweenStatements; k++) lines.push('')
        depth = 0
        stack.length = 0
        clause = ''
        break
      case 'dot':
        line = line.replace(/\s+$/, '') + '.'
        break
      case 'comment':
        if (t.v.startsWith('--')) {
          push(t.v)
          nl()
        } else push(t.v)
        break
      case 'op':
        push(t.v)
        break
      default:
        push(t.v, !(line.endsWith('.') || line.endsWith('(')))
    }
  }
  flush()
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

export function minifySql(sql: string): string {
  const toks = tokenize(sql).filter((t) => t.k !== 'comment' && t.k !== 'ws')
  const wordish = (t?: T) => !!t && (t.k === 'word' || t.k === 'num' || t.k === 'str')
  let out = ''
  toks.forEach((t, i) => {
    const prev = toks[i - 1]
    if (prev && ((wordish(prev) && wordish(t)) || (prev.k === 'rp' && wordish(t)) || (prev.k === 'semi'))) out += ' '
    out += t.v
  })
  return out.trim()
}
