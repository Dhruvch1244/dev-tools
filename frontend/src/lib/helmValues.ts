import * as yaml from 'js-yaml'

/** Helm-style values layering: maps deep-merge, lists and scalars replace, null deletes a key. Tracks which file set each leaf. */

export type Layer = { name: string; text: string }
export type Origin = Record<string, string>

type V = unknown
const isMap = (v: V): v is Record<string, V> => !!v && typeof v === 'object' && !Array.isArray(v)

export function merge(layers: { name: string; value: V }[]): { merged: Record<string, V>; origin: Origin } {
  const origin: Origin = {}
  const into = (base: Record<string, V>, over: Record<string, V>, src: string, path: string) => {
    for (const [k, v] of Object.entries(over)) {
      const p = path ? `${path}.${k}` : k
      if (v === null) {
        delete base[k]
        for (const key of Object.keys(origin)) if (key === p || key.startsWith(p + '.')) delete origin[key]
        origin[p] = `${src} (deleted)`
      } else if (isMap(v) && isMap(base[k])) into(base[k] as Record<string, V>, v, src, p)
      else {
        base[k] = isMap(v) ? structuredClone(v) : v
        for (const key of Object.keys(origin)) if (key.startsWith(p + '.')) delete origin[key]
        if (isMap(v)) markAll(v, src, p)
        else origin[p] = src
      }
    }
  }
  const markAll = (v: Record<string, V>, src: string, path: string) => {
    for (const [k, x] of Object.entries(v)) {
      const p = `${path}.${k}`
      if (isMap(x)) markAll(x, src, p)
      else origin[p] = src
    }
  }
  const merged: Record<string, V> = {}
  for (const l of layers) if (isMap(l.value)) into(merged, l.value, l.name, '')
  return { merged, origin }
}

/** --set a.b=1,c[0]=x,d=true → nested object (Helm's type inference: numbers, booleans, null). */
export function parseSet(expr: string): Record<string, V> {
  const out: Record<string, V> = {}
  for (const pair of expr.split(/,(?![^[]*\])/).map((s) => s.trim()).filter(Boolean)) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const keyPath = pair.slice(0, eq)
    const raw = pair.slice(eq + 1)
    const val: V = raw === 'true' ? true : raw === 'false' ? false : raw === 'null' ? null : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw
    const parts = keyPath.split(/\.(?![^[]*\])/)
    let cur: Record<string, V> | V[] = out
    parts.forEach((part, i) => {
      const m = /^(.+?)\[(\d+)\]$/.exec(part)
      const last = i === parts.length - 1
      if (m) {
        const obj = cur as Record<string, V>
        if (!Array.isArray(obj[m[1]])) obj[m[1]] = []
        const list = obj[m[1]] as V[]
        const idx = Number(m[2])
        if (last) list[idx] = val
        else {
          if (!isMap(list[idx])) list[idx] = {}
          cur = list[idx] as Record<string, V>
        }
      } else {
        const obj = cur as Record<string, V>
        if (last) obj[part] = val
        else {
          if (!isMap(obj[part])) obj[part] = {}
          cur = obj[part] as Record<string, V>
        }
      }
    })
  }
  return out
}

export function flatten(v: V, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (isMap(v)) {
    if (!Object.keys(v).length && prefix) out[prefix] = '{}'
    for (const [k, x] of Object.entries(v)) flatten(x, prefix ? `${prefix}.${k}` : k, out)
  } else out[prefix] = Array.isArray(v) ? JSON.stringify(v) : String(v)
  return out
}

export function parseLayer(l: Layer): { value: V; error?: string } {
  try {
    return { value: (yaml.load(l.text) as V) ?? {} }
  } catch (e) {
    return { value: {}, error: e instanceof Error ? e.message.split('\n')[0] : 'invalid YAML' }
  }
}

export function toYaml(v: V): string {
  return yaml.dump(v, { lineWidth: 120, noRefs: true, sortKeys: false })
}
