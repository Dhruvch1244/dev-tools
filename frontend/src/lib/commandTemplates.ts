export type Placeholder = { name: string; defaultValue: string }

const PLACEHOLDER_RE = /<([a-zA-Z0-9_.-]+)(?:=([^<>]*))?>/g

/** Extracts unique placeholders in first-seen order — `<name>` or `<name=default value>`. */
export function parsePlaceholders(template: string): Placeholder[] {
  const seen = new Map<string, string>()
  for (const m of template.matchAll(PLACEHOLDER_RE)) {
    const name = m[1]
    if (!seen.has(name)) seen.set(name, m[2] ?? '')
  }
  return Array.from(seen, ([name, defaultValue]) => ({ name, defaultValue }))
}

/** Substitutes every `<name>` / `<name=default>` occurrence of each placeholder with its current value. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_m, name: string) => (name in values ? values[name] : ''))
}
