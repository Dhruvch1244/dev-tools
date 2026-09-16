import { load as yamlLoad, dump as yamlDump } from 'js-yaml'

export type ConfigFormat = 'json' | 'yaml' | 'toml' | 'properties'

/** A JS value tree — the common representation every format converts through. */
export type ConfigValue = unknown

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ---- properties (flat key=value, dot-nested keys <-> nested object) ----

function parseProperties(text: string): ConfigValue {
  const root: Record<string, unknown> = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('!')) continue
    const eq = line.search(/[:=]/)
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    setDotted(root, key, coerceScalar(value))
  }
  return root
}

function stringifyProperties(value: ConfigValue): string {
  const lines: string[] = []
  flattenDotted(value, '', lines)
  return lines.join('\n') + (lines.length ? '\n' : '')
}

function setDotted(root: Record<string, unknown>, dottedKey: string, value: unknown) {
  const parts = dottedKey.split('.')
  let cur = root
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!isPlainObject(cur[p])) cur[p] = {}
    cur = cur[p] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

function flattenDotted(value: ConfigValue, prefix: string, out: string[]) {
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) flattenDotted(v, prefix ? `${prefix}.${k}` : k, out)
  } else if (Array.isArray(value)) {
    out.push(`${prefix}=${value.map(String).join(',')}`)
  } else {
    out.push(`${prefix}=${value === null || value === undefined ? '' : String(value)}`)
  }
}

function coerceScalar(s: string): unknown {
  if (s === 'true') return true
  if (s === 'false') return false
  if (s !== '' && !isNaN(Number(s))) return Number(s)
  return s
}

// ---- minimal TOML (top-level + [section]/[section.sub] headers, scalars + inline arrays) ----

function parseToml(text: string): ConfigValue {
  const root: Record<string, unknown> = {}
  let cur = root
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      const parts = sectionMatch[1].split('.').map((p) => p.trim())
      cur = root
      for (const p of parts) {
        if (!isPlainObject(cur[p])) cur[p] = {}
        cur = cur[p] as Record<string, unknown>
      }
      continue
    }
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim().replace(/^["']|["']$/g, '')
    const rawValue = line.slice(eq + 1).trim()
    cur[key] = parseTomlValue(rawValue)
  }
  return root
}

function parseTomlValue(raw: string): unknown {
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim()
    if (!inner) return []
    return splitTop(inner, ',').map((v) => parseTomlValue(v.trim()))
  }
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) return raw.slice(1, -1)
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (!isNaN(Number(raw)) && raw !== '') return Number(raw)
  return raw
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

function stringifyToml(value: ConfigValue, path: string[] = []): string {
  if (!isPlainObject(value)) return ''
  const scalarLines: string[] = []
  const sections: string[] = []
  for (const [k, v] of Object.entries(value)) {
    if (isPlainObject(v)) {
      const nested = stringifyToml(v, [...path, k])
      sections.push(`[${[...path, k].join('.')}]\n${nested}`)
    } else {
      scalarLines.push(`${k} = ${tomlLiteral(v)}`)
    }
  }
  return [scalarLines.join('\n'), ...sections].filter(Boolean).join('\n\n') + (path.length === 0 ? '\n' : '\n')
}

function tomlLiteral(v: unknown): string {
  if (typeof v === 'string') return `"${v.replace(/"/g, '\\"')}"`
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return `[${v.map(tomlLiteral).join(', ')}]`
  return 'null'
}

// ---- public API ----

export function parseConfig(text: string, format: ConfigFormat): ConfigValue {
  switch (format) {
    case 'json': return JSON.parse(text)
    case 'yaml': return yamlLoad(text)
    case 'toml': return parseToml(text)
    case 'properties': return parseProperties(text)
  }
}

export function stringifyConfig(value: ConfigValue, format: ConfigFormat): string {
  switch (format) {
    case 'json': return JSON.stringify(value, null, 2)
    case 'yaml': return yamlDump(value)
    case 'toml': return stringifyToml(value)
    case 'properties': return stringifyProperties(value)
  }
}

export function convertConfig(text: string, from: ConfigFormat, to: ConfigFormat): string {
  const value = parseConfig(text, from)
  return stringifyConfig(value, to)
}
