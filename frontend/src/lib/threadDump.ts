export type ThreadState = 'RUNNABLE' | 'BLOCKED' | 'WAITING' | 'TIMED_WAITING' | 'NEW' | 'TERMINATED' | 'UNKNOWN'

export type ParsedThread = {
  name: string
  state: ThreadState
  daemon: boolean
  stack: string[]
  waitingToLock: string | null
  locks: string[]
}

export type ThreadDumpResult = {
  threads: ParsedThread[]
  deadlockCycles: string[][]
  rawDeadlockSection: string | null
}

const HEADER_RE = /^"([^"]+)"(.*)$/
const STATE_RE = /java\.lang\.Thread\.State:\s+(\w+)/
const WAITING_TO_LOCK_RE = /- waiting to lock <(0x[0-9a-fA-F]+)>/
const LOCKED_RE = /- locked <(0x[0-9a-fA-F]+)>/

export function parseThreadDump(text: string): ThreadDumpResult {
  const lines = text.split('\n')
  const threads: ParsedThread[] = []
  let current: ParsedThread | null = null

  const rawDeadlockMatch = text.match(/Found (?:one|\d+) Java-level deadlock[\s\S]*?(?=\n\n\S|\n*$)/)

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    const header = line.match(HEADER_RE)
    if (header) {
      if (current) threads.push(current)
      current = {
        name: header[1],
        state: 'UNKNOWN',
        daemon: /\bdaemon\b/.test(header[2]),
        stack: [],
        waitingToLock: null,
        locks: [],
      }
      continue
    }
    if (!current) continue
    const stateMatch = line.match(STATE_RE)
    if (stateMatch) {
      const s = stateMatch[1] as ThreadState
      current.state = ['RUNNABLE', 'BLOCKED', 'WAITING', 'TIMED_WAITING', 'NEW', 'TERMINATED'].includes(s) ? s : 'UNKNOWN'
      continue
    }
    const waitMatch = line.match(WAITING_TO_LOCK_RE)
    if (waitMatch && !current.waitingToLock) current.waitingToLock = waitMatch[1]
    const lockMatch = line.match(LOCKED_RE)
    if (lockMatch) current.locks.push(lockMatch[1])
    if (line.trim().startsWith('at ') || line.trim().startsWith('- ')) current.stack.push(line.trim())
  }
  if (current) threads.push(current)

  // wait-for graph: thread -> thread it's blocked waiting on
  const lockOwner = new Map<string, string>()
  for (const t of threads) for (const lock of t.locks) lockOwner.set(lock, t.name)

  const waitsFor = new Map<string, string>()
  for (const t of threads) {
    if (t.waitingToLock) {
      const owner = lockOwner.get(t.waitingToLock)
      if (owner && owner !== t.name) waitsFor.set(t.name, owner)
    }
  }

  const cycles: string[][] = []
  const seenCycleKeys = new Set<string>()
  for (const start of waitsFor.keys()) {
    const path: string[] = [start]
    const visited = new Set([start])
    let cur = start
    while (waitsFor.has(cur)) {
      const next = waitsFor.get(cur)!
      if (visited.has(next)) {
        const cycleStart = path.indexOf(next)
        const cycle = path.slice(cycleStart)
        const key = [...cycle].sort().join('|')
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key)
          cycles.push(cycle)
        }
        break
      }
      path.push(next)
      visited.add(next)
      cur = next
    }
  }

  return { threads, deadlockCycles: cycles, rawDeadlockSection: rawDeadlockMatch ? rawDeadlockMatch[0] : null }
}
