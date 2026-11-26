/**
 * A JSONPath evaluator (Goessner syntax): $ . .. * [n] [-1] [a,b] ['key'] [start:end:step]
 * and filters [?(@.price < 10 && @.tags)] with a tiny safe expression evaluator — no eval().
 */

export type JsonPathResult = { path: string; value: unknown }

type Seg =
  | { t: 'child'; names: (string | number)[] }
  | { t: 'wild' }
  | { t: 'desc' }
  | { t: 'slice'; start?: number; end?: number; step?: number }
  | { t: 'filter'; expr: string }

function tokenize(path: string): Seg[] {
  let p = path.trim()
  if (!p.startsWith('$')) p = '$' + (p.startsWith('.') || p.startsWith('[') ? '' : '.') + p
  const segs: Seg[] = []
  let i = 1
  while (i < p.length) {
    const c = p[i]
    if (c === '.') {
      if (p[i + 1] === '.') {
        segs.push({ t: 'desc' })
        i += 2
        if (p[i] === '[') continue
      } else i++
      if (p[i] === '*') {
        segs.push({ t: 'wild' })
        i++
        continue
      }
      const m = /^[^.[\]\s]+/.exec(p.slice(i))
      if (!m) throw new Error(`Expected a name at position ${i}`)
      segs.push({ t: 'child', names: [m[0]] })
      i += m[0].length
    } else if (c === '[') {
      let depth = 0
      let j = i
      let q: string | null = null
      for (; j < p.length; j++) {
        const ch = p[j]
        if (q) {
          if (ch === '\\') j++
          else if (ch === q) q = null
          continue
        }
        if (ch === "'" || ch === '"') q = ch
        else if (ch === '[') depth++
        else if (ch === ']' && --depth === 0) break
      }
      if (j >= p.length) throw new Error('Unclosed [')
      const inner = p.slice(i + 1, j).trim()
      i = j + 1
      if (inner === '*') segs.push({ t: 'wild' })
      else if (inner.startsWith('?')) segs.push({ t: 'filter', expr: inner.replace(/^\?\s*\(?/, '').replace(/\)\s*$/, '') })
      else if (/^-?\d*:-?\d*(:-?\d*)?$/.test(inner)) {
        const [a, b, s] = inner.split(':')
        segs.push({ t: 'slice', start: a ? +a : undefined, end: b ? +b : undefined, step: s ? +s : undefined })
      } else {
        const names = splitTop(inner).map((x) => {
          const s = x.trim()
          if (/^-?\d+$/.test(s)) return Number(s)
          if (/^(['"]).*\1$/.test(s)) return s.slice(1, -1).replace(/\\(.)/g, '$1')
          return s
        })
        segs.push({ t: 'child', names })
      }
    } else throw new Error(`Unexpected "${c}" at position ${i}`)
  }
  return segs
}

function splitTop(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let q: string | null = null
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      cur += ch
      if (ch === '\\') cur += s[++i] ?? ''
      else if (ch === q) q = null
      continue
    }
    if (ch === "'" || ch === '"') {
      q = ch
      cur += ch
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function fmtKey(k: string | number): string {
  return typeof k === 'number' ? `[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `.${k}` : `['${k.replace(/'/g, "\\'")}']`
}

// ---------- filter expressions: @.a.b, literals, == != < <= > >= =~ && || ! ( ) , in
type Tok = { k: 'num' | 'str' | 'ref' | 'op' | 'lp' | 'rp' | 'bool' | 'null' | 'regex'; v: string }

function lex(expr: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < expr.length) {
    const rest = expr.slice(i)
    let m: RegExpExecArray | null
    if (/^\s/.test(rest)) { i++; continue }
    if ((m = /^(==|!=|<=|>=|=~|&&|\|\||<|>|!)/.exec(rest))) toks.push({ k: 'op', v: m[0] })
    else if ((m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(rest))) toks.push({ k: 'num', v: m[0] })
    else if ((m = /^'((?:\\.|[^'])*)'|^"((?:\\.|[^"])*)"/.exec(rest))) toks.push({ k: 'str', v: (m[1] ?? m[2]).replace(/\\(.)/g, '$1') })
    else if ((m = /^\/((?:\\.|[^/])+)\/([a-z]*)/.exec(rest)) && toks.length && toks[toks.length - 1].v === '=~') toks.push({ k: 'regex', v: m[0] })
    else if ((m = /^(true|false)\b/.exec(rest))) toks.push({ k: 'bool', v: m[0] })
    else if ((m = /^null\b/.exec(rest))) toks.push({ k: 'null', v: m[0] })
    else if ((m = /^[@$](?:\.[A-Za-z_$][\w$-]*|\[(?:'[^']*'|"[^"]*"|-?\d+)\]|\.length)*/.exec(rest)) && m[0].length) toks.push({ k: 'ref', v: m[0] })
    else if (rest[0] === '(') { toks.push({ k: 'lp', v: '(' }); i++; continue }
    else if (rest[0] === ')') { toks.push({ k: 'rp', v: ')' }); i++; continue }
    else throw new Error(`Can't parse filter near "${rest.slice(0, 12)}"`)
    i += m![0].length
  }
  return toks
}

function resolveRef(ref: string, at: unknown, root: unknown): unknown {
  let cur: unknown = ref[0] === '@' ? at : root
  const re = /\.([A-Za-z_$][\w$-]*)|\[(?:'([^']*)'|"([^"]*)"|(-?\d+))\]/g
  let m: RegExpExecArray | null
  re.lastIndex = 1
  while ((m = re.exec(ref))) {
    const key = m[1] ?? m[2] ?? m[3] ?? Number(m[4])
    if (key === 'length' && (Array.isArray(cur) || typeof cur === 'string')) { cur = (cur as unknown[]).length; continue }
    if (cur === null || typeof cur !== 'object') return undefined
    if (Array.isArray(cur) && typeof key === 'number') cur = cur[key < 0 ? cur.length + key : key]
    else cur = (cur as Record<string, unknown>)[key as string]
  }
  return cur
}

function evalFilter(expr: string, at: unknown, root: unknown): boolean {
  const toks = lex(expr)
  let pos = 0
  const peek = () => toks[pos]
  const take = () => toks[pos++]
  function primary(): unknown {
    const t = take()
    if (!t) throw new Error('Unexpected end of filter')
    if (t.k === 'lp') {
      const v = or()
      if (take()?.k !== 'rp') throw new Error('Missing )')
      return v
    }
    if (t.k === 'op' && t.v === '!') return !truthy(primary())
    if (t.k === 'num') return Number(t.v)
    if (t.k === 'str') return t.v
    if (t.k === 'bool') return t.v === 'true'
    if (t.k === 'null') return null
    if (t.k === 'regex') {
      const m = /^\/(.*)\/([a-z]*)$/.exec(t.v)!
      return new RegExp(m[1], m[2])
    }
    if (t.k === 'ref') return resolveRef(t.v, at, root)
    throw new Error(`Unexpected "${t.v}"`)
  }
  function cmp(): unknown {
    const left = primary()
    const t = peek()
    if (t && t.k === 'op' && ['==', '!=', '<', '<=', '>', '>=', '=~'].includes(t.v)) {
      take()
      const right = primary()
      switch (t.v) {
        case '==': return left === right || (left != null && right != null && String(left) === String(right) && typeof left === typeof right)
        case '!=': return left !== right
        case '<': return (left as number) < (right as number)
        case '<=': return (left as number) <= (right as number)
        case '>': return (left as number) > (right as number)
        case '>=': return (left as number) >= (right as number)
        case '=~': return right instanceof RegExp && typeof left === 'string' && right.test(left)
      }
    }
    return left
  }
  function and(): unknown {
    let v = cmp()
    while (peek()?.v === '&&') {
      take()
      const r = cmp()
      v = truthy(v) && truthy(r)
    }
    return v
  }
  function or(): unknown {
    let v = and()
    while (peek()?.v === '||') {
      take()
      const r = and()
      v = truthy(v) || truthy(r)
    }
    return v
  }
  const result = or()
  if (pos < toks.length) throw new Error(`Unexpected "${toks[pos].v}" in filter`)
  return truthy(result)
}

function truthy(v: unknown): boolean {
  return !(v === undefined || v === null || v === false || v === 0 || v === '')
}

export function query(root: unknown, path: string, limit = 5000): JsonPathResult[] {
  const segs = tokenize(path)
  let cur: JsonPathResult[] = [{ path: '$', value: root }]
  for (const seg of segs) {
    const next: JsonPathResult[] = []
    for (const { path: p, value } of cur) {
      if (seg.t === 'desc') {
        const walk = (pp: string, v: unknown) => {
          next.push({ path: pp, value: v })
          if (next.length > limit * 4) return
          if (Array.isArray(v)) v.forEach((x, i) => walk(pp + fmtKey(i), x))
          else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(pp + fmtKey(k), x)
        }
        walk(p, value)
        continue
      }
      if (value === null || typeof value !== 'object') continue
      if (seg.t === 'wild') {
        if (Array.isArray(value)) value.forEach((x, i) => next.push({ path: p + fmtKey(i), value: x }))
        else for (const [k, x] of Object.entries(value)) next.push({ path: p + fmtKey(k), value: x })
      } else if (seg.t === 'child') {
        for (const n of seg.names) {
          if (Array.isArray(value) && typeof n === 'number') {
            const idx = n < 0 ? value.length + n : n
            if (idx >= 0 && idx < value.length) next.push({ path: p + fmtKey(idx), value: value[idx] })
          } else if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, String(n))) {
            next.push({ path: p + fmtKey(String(n)), value: (value as Record<string, unknown>)[String(n)] })
          }
        }
      } else if (seg.t === 'slice') {
        if (!Array.isArray(value)) continue
        const len = value.length
        const step = seg.step ?? 1
        if (step === 0) throw new Error('Slice step cannot be 0')
        const norm = (x: number | undefined, d: number) => (x === undefined ? d : x < 0 ? Math.max(0, len + x) : Math.min(len, x))
        if (step > 0) for (let i = norm(seg.start, 0); i < norm(seg.end, len); i += step) next.push({ path: p + fmtKey(i), value: value[i] })
        else for (let i = seg.start === undefined ? len - 1 : norm(seg.start, len - 1); i > (seg.end === undefined ? -1 : norm(seg.end, -1)); i += step) next.push({ path: p + fmtKey(i), value: value[i] })
      } else if (seg.t === 'filter') {
        const entries: [string | number, unknown][] = Array.isArray(value) ? value.map((x, i) => [i, x]) : Object.entries(value)
        for (const [k, x] of entries) if (evalFilter(seg.expr, x, root)) next.push({ path: p + fmtKey(k), value: x })
      }
    }
    cur = next.slice(0, limit * 4)
  }
  // ".." yields the starting node too; dedupe identical paths
  const seen = new Set<string>()
  return cur.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true))).slice(0, limit)
}

/** All leaf/branch paths of a document — powers the "click a value to get its path" helper. */
export function allPaths(root: unknown, max = 3000): string[] {
  const out: string[] = []
  const walk = (p: string, v: unknown) => {
    if (out.length >= max) return
    out.push(p)
    if (Array.isArray(v)) v.forEach((x, i) => walk(p + fmtKey(i), x))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(p + fmtKey(k), x)
  }
  walk('$', root)
  return out
}
