export type DiffOp = { type: 'equal' | 'add' | 'remove'; line: string }

/**
 * Classic LCS-based line diff. O(n*m) time/space, which is fine for the pasted-text sizes this
 * tool is meant for (comparing two API responses, two config files) — not for multi-MB inputs.
 */
export function diffLines(before: string, after: string): DiffOp[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const n = a.length
  const m = b.length

  const lengths: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', line: a[i] })
      i++
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      ops.push({ type: 'remove', line: a[i] })
      i++
    } else {
      ops.push({ type: 'add', line: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ type: 'remove', line: a[i++] })
  while (j < m) ops.push({ type: 'add', line: b[j++] })
  return ops
}

export type WordOp = { type: 'equal' | 'add' | 'remove'; text: string }

function tokenizeWords(line: string): string[] {
  return line.split(/(\s+)/).filter((t) => t.length > 0)
}

/** Same LCS approach as diffLines, one level down — word tokens instead of lines. */
export function diffWords(before: string, after: string): WordOp[] {
  const a = tokenizeWords(before)
  const b = tokenizeWords(after)
  const n = a.length
  const m = b.length

  const lengths: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const ops: WordOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', text: a[i] })
      i++
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      ops.push({ type: 'remove', text: a[i] })
      i++
    } else {
      ops.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ type: 'remove', text: a[i++] })
  while (j < m) ops.push({ type: 'add', text: b[j++] })
  return ops
}

/** Same LCS approach, one level down again — individual characters, with adjacent same-type runs merged. */
export function diffChars(before: string, after: string): WordOp[] {
  const a = Array.from(before)
  const b = Array.from(after)
  const n = a.length
  const m = b.length

  const lengths: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const raw: WordOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ type: 'equal', text: a[i] })
      i++
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      raw.push({ type: 'remove', text: a[i] })
      i++
    } else {
      raw.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) raw.push({ type: 'remove', text: a[i++] })
  while (j < m) raw.push({ type: 'add', text: b[j++] })

  const merged: WordOp[] = []
  for (const op of raw) {
    const last = merged[merged.length - 1]
    if (last && last.type === op.type) last.text += op.text
    else merged.push({ ...op })
  }
  return merged
}

export type DiffToken = { text: string; highlight: boolean }

/**
 * Word-level diff, refined to character-level for substituted word pairs (a remove immediately
 * followed by an add) so "hello" -> "hallo" highlights just the "e"/"a", not the whole word.
 * Pure insertions/deletions (no counterpart on the other side) stay whole-token highlighted.
 */
export function refineDiff(before: string, after: string): { beforeTokens: DiffToken[]; afterTokens: DiffToken[] } {
  const wordOps = diffWords(before, after)
  const beforeTokens: DiffToken[] = []
  const afterTokens: DiffToken[] = []
  let i = 0
  while (i < wordOps.length) {
    const op = wordOps[i]
    if (op.type === 'equal') {
      beforeTokens.push({ text: op.text, highlight: false })
      afterTokens.push({ text: op.text, highlight: false })
      i++
      continue
    }
    if (op.type === 'remove' && i + 1 < wordOps.length && wordOps[i + 1].type === 'add' && op.text.trim() && wordOps[i + 1].text.trim()) {
      const charOps = diffChars(op.text, wordOps[i + 1].text)
      for (const c of charOps) {
        if (c.type === 'remove') beforeTokens.push({ text: c.text, highlight: true })
        else if (c.type === 'equal') beforeTokens.push({ text: c.text, highlight: false })
      }
      for (const c of charOps) {
        if (c.type === 'add') afterTokens.push({ text: c.text, highlight: true })
        else if (c.type === 'equal') afterTokens.push({ text: c.text, highlight: false })
      }
      i += 2
      continue
    }
    if (op.type === 'remove') {
      beforeTokens.push({ text: op.text, highlight: true })
      i++
      continue
    }
    afterTokens.push({ text: op.text, highlight: true })
    i++
  }
  return { beforeTokens, afterTokens }
}

export type DiffRow = { kind: 'equal' | 'remove' | 'add'; line: string } | { kind: 'change'; before: string; after: string }

/**
 * Groups raw line ops into rows for rendering: a remove immediately followed by an add is
 * treated as one modified line (not a delete-then-insert) so the UI can word-diff it instead
 * of just painting both lines solid red/green. Unequal-length remove/add runs pair positionally
 * and spill the remainder as plain removes/adds.
 */
export function groupDiffRows(ops: DiffOp[]): DiffRow[] {
  const rows: DiffRow[] = []
  let i = 0
  while (i < ops.length) {
    const op = ops[i]
    if (op.type === 'equal') {
      rows.push({ kind: 'equal', line: op.line })
      i++
      continue
    }
    const removes: string[] = []
    while (i < ops.length && ops[i].type === 'remove') {
      removes.push(ops[i].line)
      i++
    }
    const adds: string[] = []
    while (i < ops.length && ops[i].type === 'add') {
      adds.push(ops[i].line)
      i++
    }
    const pairCount = Math.min(removes.length, adds.length)
    for (let k = 0; k < pairCount; k++) rows.push({ kind: 'change', before: removes[k], after: adds[k] })
    for (let k = pairCount; k < removes.length; k++) rows.push({ kind: 'remove', line: removes[k] })
    for (let k = pairCount; k < adds.length; k++) rows.push({ kind: 'add', line: adds[k] })
  }
  return rows
}
