/** IPv4 CIDR math on unsigned 32-bit numbers. */

export type CidrInfo = {
  input: string
  ip: number
  prefix: number
  network: number
  broadcast: number
  mask: number
  wildcard: number
  firstHost: number
  lastHost: number
  total: number
  usable: number
  klass: string
  scope: string
}

export function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n >>> 0
}

export function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.')
}

export function maskFromPrefix(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

export function prefixFromMask(mask: string): number | null {
  const m = ipToInt(mask)
  if (m === null) return null
  const bits = m.toString(2).padStart(32, '0')
  if (!/^1*0*$/.test(bits)) return null
  return bits.indexOf('0') === -1 ? 32 : bits.indexOf('0')
}

function scopeOf(ip: number): string {
  const inR = (cidr: string) => contains(parseCidr(cidr)!, ip)
  if (inR('10.0.0.0/8') || inR('172.16.0.0/12') || inR('192.168.0.0/16')) return 'Private (RFC 1918)'
  if (inR('100.64.0.0/10')) return 'Carrier-grade NAT (RFC 6598)'
  if (inR('127.0.0.0/8')) return 'Loopback'
  if (inR('169.254.0.0/16')) return 'Link-local'
  if (inR('224.0.0.0/4')) return 'Multicast'
  if (inR('240.0.0.0/4')) return 'Reserved'
  if (inR('0.0.0.0/8')) return '"This" network'
  return 'Public'
}

/** Accepts "10.0.0.0/16", "10.0.0.5 255.255.0.0", or a bare IP (treated as /32). */
export function parseCidr(input: string): CidrInfo | null {
  const t = input.trim()
  let ipStr = t
  let prefix = 32
  const slash = t.split('/')
  if (slash.length === 2) {
    ipStr = slash[0]
    if (!/^\d{1,2}$/.test(slash[1]) || Number(slash[1]) > 32) return null
    prefix = Number(slash[1])
  } else {
    const sp = t.split(/\s+/)
    if (sp.length === 2) {
      ipStr = sp[0]
      const p = prefixFromMask(sp[1])
      if (p === null) return null
      prefix = p
    }
  }
  const ip = ipToInt(ipStr)
  if (ip === null) return null
  const mask = maskFromPrefix(prefix)
  const network = (ip & mask) >>> 0
  const wildcard = ~mask >>> 0
  const broadcast = (network | wildcard) >>> 0
  const total = 2 ** (32 - prefix)
  const usable = prefix >= 31 ? total : total - 2
  const first = ip >>> 24
  const klass = first < 128 ? 'A' : first < 192 ? 'B' : first < 224 ? 'C' : first < 240 ? 'D (multicast)' : 'E (reserved)'
  return {
    input: t,
    ip,
    prefix,
    network,
    broadcast,
    mask,
    wildcard,
    firstHost: prefix >= 31 ? network : network + 1,
    lastHost: prefix >= 31 ? broadcast : broadcast - 1,
    total,
    usable,
    klass,
    scope: '',
  }
}

export function withScope(c: CidrInfo): CidrInfo {
  return { ...c, scope: scopeOf(c.network) }
}

export function contains(c: CidrInfo, ip: number): boolean {
  return ((ip & c.mask) >>> 0) === c.network
}

export function overlaps(a: CidrInfo, b: CidrInfo): boolean {
  return a.network <= b.broadcast && b.network <= a.broadcast
}

export function split(c: CidrInfo, newPrefix: number, limit = 256): CidrInfo[] {
  if (newPrefix < c.prefix || newPrefix > 32) return []
  const size = 2 ** (32 - newPrefix)
  const n = Math.min(2 ** (newPrefix - c.prefix), limit)
  const out: CidrInfo[] = []
  for (let i = 0; i < n; i++) out.push(parseCidr(`${intToIp(c.network + i * size)}/${newPrefix}`)!)
  return out
}

/** Smallest set of CIDR blocks exactly covering [start, end]. */
export function rangeToCidrs(start: number, end: number): string[] {
  const out: string[] = []
  let s = start
  while (s <= end && out.length < 512) {
    let size = 32
    while (size > 0) {
      const mask = maskFromPrefix(size - 1)
      const blockStart = (s & mask) >>> 0
      const blockEnd = (blockStart | (~mask >>> 0)) >>> 0
      if (blockStart !== s || blockEnd > end) break
      size--
    }
    out.push(`${intToIp(s)}/${size}`)
    s = s + 2 ** (32 - size)
  }
  return out
}

export function toBinary(n: number): string {
  return n.toString(2).padStart(32, '0').replace(/(.{8})(?!$)/g, '$1.')
}
