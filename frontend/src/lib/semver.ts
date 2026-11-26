/** Small, dependency-free SemVer 2.0 implementation: parse, compare, bump, and npm-style ranges. */

export type SemVer = { major: number; minor: number; patch: number; pre: (string | number)[]; build: string[]; raw: string }

const RE = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export function parse(v: string): SemVer | null {
  const m = RE.exec(v.trim())
  if (!m) return null
  return {
    major: +m[1],
    minor: +m[2],
    patch: +m[3],
    pre: m[4] ? m[4].split('.').map((x) => (/^\d+$/.test(x) ? Number(x) : x)) : [],
    build: m[5] ? m[5].split('.') : [],
    raw: v.trim(),
  }
}

/** Lenient: "1.2" → 1.2.0, "v3" → 3.0.0, "1.2.3.4" → null. */
export function coerce(v: string): SemVer | null {
  const strict = parse(v)
  if (strict) return strict
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim())
  if (!m) return null
  return parse(`${m[1]}.${m[2] ?? 0}.${m[3] ?? 0}${m[4] ? `-${m[4]}` : ''}`)
}

export function format(s: SemVer): string {
  return `${s.major}.${s.minor}.${s.patch}${s.pre.length ? `-${s.pre.join('.')}` : ''}${s.build.length ? `+${s.build.join('.')}` : ''}`
}

export function compare(a: SemVer, b: SemVer): number {
  for (const k of ['major', 'minor', 'patch'] as const) if (a[k] !== b[k]) return a[k] > b[k] ? 1 : -1
  if (!a.pre.length && b.pre.length) return 1
  if (a.pre.length && !b.pre.length) return -1
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    if (typeof x === 'number' && typeof y === 'number') return x > y ? 1 : -1
    if (typeof x === 'number') return -1
    if (typeof y === 'number') return 1
    return x > y ? 1 : -1
  }
  return 0
}

export type Bump = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease'

export function bump(s: SemVer, kind: Bump, preId = 'rc'): SemVer {
  const n: SemVer = { ...s, pre: [...s.pre], build: [] }
  switch (kind) {
    case 'major':
      if (!(s.minor === 0 && s.patch === 0 && s.pre.length)) n.major++
      n.minor = 0
      n.patch = 0
      n.pre = []
      break
    case 'minor':
      if (!(s.patch === 0 && s.pre.length)) n.minor++
      n.patch = 0
      n.pre = []
      break
    case 'patch':
      if (!s.pre.length) n.patch++
      n.pre = []
      break
    case 'premajor':
      n.major++
      n.minor = 0
      n.patch = 0
      n.pre = [preId, 0]
      break
    case 'preminor':
      n.minor++
      n.patch = 0
      n.pre = [preId, 0]
      break
    case 'prepatch':
      n.patch++
      n.pre = [preId, 0]
      break
    case 'prerelease':
      if (!s.pre.length) {
        n.patch++
        n.pre = [preId, 0]
      } else {
        const last = n.pre[n.pre.length - 1]
        if (typeof last === 'number') n.pre[n.pre.length - 1] = last + 1
        else n.pre.push(0)
        if (n.pre[0] !== preId && preId) n.pre = [preId, 0]
      }
      break
  }
  n.raw = format(n)
  return n
}

type Comparator = { op: '<' | '<=' | '>' | '>=' | '='; v: SemVer }

function cmp(op: Comparator['op'], v: SemVer): Comparator {
  return { op, v }
}

function partial(str: string): { major?: number; minor?: number; patch?: number; pre: string } {
  const m = /^v?(\d+|x|X|\*)?(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z.-]+))?$/.exec(str)
  if (!m) throw new Error(`Invalid version in range: "${str}"`)
  const num = (x?: string) => (x === undefined || /^[xX*]$/.test(x) ? undefined : Number(x))
  return { major: num(m[1]), minor: num(m[2]), patch: num(m[3]), pre: m[4] ?? '' }
}

function mk(major = 0, minor = 0, patch = 0, pre = ''): SemVer {
  return parse(`${major}.${minor}.${patch}${pre ? `-${pre}` : ''}`)!
}

function expand(token: string): Comparator[] {
  if (token === '' || token === '*' || token === 'x' || token === 'X') return []
  const opM = /^(<=|>=|<|>|=|\^|~>?)?\s*(.+)$/.exec(token)!
  const op = opM[1] ?? ''
  const p = partial(opM[2])
  const { major, minor, patch, pre } = p
  if (op === '^') {
    if (major === undefined) return []
    const lo = mk(major, minor ?? 0, patch ?? 0, pre)
    const hi = major > 0 || minor === undefined ? mk(major + 1) : (minor ?? 0) > 0 || patch === undefined ? mk(major, (minor ?? 0) + 1) : mk(major, minor ?? 0, (patch ?? 0) + 1)
    return [cmp('>=', lo), cmp('<', { ...hi, pre: [0] })]
  }
  if (op === '~' || op === '~>') {
    if (major === undefined) return []
    const lo = mk(major, minor ?? 0, patch ?? 0, pre)
    const hi = minor === undefined ? mk(major + 1) : mk(major, minor + 1)
    return [cmp('>=', lo), cmp('<', { ...hi, pre: [0] })]
  }
  // x-ranges and plain comparators
  if (major === undefined) return op === '<' || op === '>' ? [cmp('<', mk(0, 0, 0, '0'))] : []
  if (minor === undefined || patch === undefined) {
    const lo = mk(major, minor ?? 0, 0)
    const hi = minor === undefined ? mk(major + 1) : mk(major, minor + 1)
    const hi0 = { ...hi, pre: [0] }
    switch (op) {
      case '>': return [cmp('>=', hi)]
      case '>=': return [cmp('>=', lo)]
      case '<': return [cmp('<', { ...lo, pre: [0] })]
      case '<=': return [cmp('<', hi0)]
      default: return [cmp('>=', lo), cmp('<', hi0)]
    }
  }
  const v = mk(major, minor, patch, pre)
  return [cmp((op || '=') as Comparator['op'], v)]
}

/** Parses "^1.2.3 || >=2.0.0 <3 || 1.x || 1.2.3 - 2.3.4" into OR-ed sets of AND-ed comparators. */
export function parseRange(range: string): Comparator[][] {
  return range.split('||').map((part) => {
    const t = part.trim()
    const hy = /^(\S+)\s+-\s+(\S+)$/.exec(t)
    if (hy) {
      const a = partial(hy[1])
      const b = partial(hy[2])
      const lo = mk(a.major ?? 0, a.minor ?? 0, a.patch ?? 0, a.pre)
      const hiC: Comparator =
        b.minor === undefined ? cmp('<', mk((b.major ?? 0) + 1)) : b.patch === undefined ? cmp('<', mk(b.major ?? 0, b.minor + 1)) : cmp('<=', mk(b.major ?? 0, b.minor, b.patch, b.pre))
      return [cmp('>=', lo), hiC]
    }
    const tokens = t.replace(/(<=|>=|<|>|=|\^|~>?)\s+/g, '$1').split(/\s+/).filter(Boolean)
    return tokens.flatMap(expand)
  })
}

function test(c: Comparator, v: SemVer): boolean {
  const r = compare(v, c.v)
  switch (c.op) {
    case '<': return r < 0
    case '<=': return r <= 0
    case '>': return r > 0
    case '>=': return r >= 0
    case '=': return r === 0
  }
}

/** npm semantics: a prerelease only satisfies a set that has a comparator on the same [major, minor, patch] with a prerelease. */
export function satisfies(v: SemVer, range: string, includePrerelease = false): boolean {
  return parseRange(range).some((set) => {
    if (!set.every((c) => test(c, v))) return false
    if (!v.pre.length || includePrerelease) return true
    return set.some((c) => c.v.pre.length > 0 && c.v.pre[0] !== 0 && c.v.major === v.major && c.v.minor === v.minor && c.v.patch === v.patch)
  })
}

export function describeRange(range: string): string {
  try {
    return parseRange(range)
      .map((set) => (set.length ? set.map((c) => `${c.op}${format({ ...c.v, pre: c.v.pre.length === 1 && c.v.pre[0] === 0 ? [] : c.v.pre })}${c.v.pre.length === 1 && c.v.pre[0] === 0 ? '-0' : ''}`).join(' ') : '*'))
      .join('  ||  ')
  } catch (e) {
    return e instanceof Error ? e.message : 'invalid range'
  }
}
