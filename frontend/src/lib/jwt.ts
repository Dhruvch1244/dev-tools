export type JwtHeader = Record<string, unknown>
export type JwtPayload = Record<string, unknown>

export function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=')
  return decodeURIComponent(escape(atob(padded)))
}

function base64UrlToBytes(segment: string): Uint8Array {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=')
  const bin = atob(padded)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export type DecodedJwt = { header: JwtHeader; payload: JwtPayload; signingInput: string; signatureB64: string }

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().split('.')
  if (parts.length < 2) throw new Error('Not a JWT — expected header.payload.signature')
  const header = JSON.parse(base64UrlDecode(parts[0])) as JwtHeader
  const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload
  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signatureB64: parts[2] ?? '' }
}

export const CLAIM_EXPLANATIONS: Record<string, string> = {
  iss: 'Issuer — who created and signed this token',
  sub: 'Subject — the principal the token is about (usually a user ID)',
  aud: 'Audience — intended recipient(s) of the token',
  exp: 'Expiration time — token is invalid after this instant',
  nbf: 'Not before — token is invalid until this instant',
  iat: 'Issued at — when the token was created',
  jti: 'JWT ID — unique identifier for this token, useful for replay protection',
  azp: 'Authorized party — the client the token was issued to',
  scope: 'Scope — space-delimited permissions granted to this token',
}

export type JwtNote = { severity: 'error' | 'warning' | 'info'; message: string }

function formatClaimTime(v: unknown): string {
  return typeof v === 'number' ? new Date(v * 1000).toLocaleString() : String(v)
}

export function analyzeJwt(header: JwtHeader, payload: JwtPayload): JwtNote[] {
  const notes: JwtNote[] = []
  const alg = typeof header.alg === 'string' ? header.alg : undefined
  const now = Date.now()

  if (!alg) {
    notes.push({ severity: 'error', message: 'No "alg" in header — cannot tell how this token is meant to be signed.' })
  } else if (alg.toLowerCase() === 'none') {
    notes.push({ severity: 'error', message: '"alg": "none" — this token is unsigned. Never trust it; a server that accepts this can be forged trivially.' })
  } else if (/^HS/i.test(alg)) {
    notes.push({ severity: 'info', message: `${alg} is symmetric (HMAC) — verifiable below if you have the shared secret.` })
  } else if (/^(RS|ES|PS)/i.test(alg)) {
    notes.push({ severity: 'info', message: `${alg} is asymmetric — verifying it needs the issuer's public key, not supported here.` })
  }

  if (payload.exp === undefined) {
    notes.push({ severity: 'warning', message: 'No "exp" claim — this token never expires.' })
  } else if (typeof payload.exp === 'number') {
    if (payload.exp * 1000 < now) notes.push({ severity: 'error', message: `Expired at ${formatClaimTime(payload.exp)}.` })
  } else {
    notes.push({ severity: 'warning', message: '"exp" is not a number — can\'t evaluate expiry.' })
  }

  if (typeof payload.nbf === 'number' && payload.nbf * 1000 > now) {
    notes.push({ severity: 'warning', message: `Not valid yet — "nbf" is ${formatClaimTime(payload.nbf)}, in the future.` })
  }
  if (typeof payload.iat === 'number' && payload.iat * 1000 > now) {
    notes.push({ severity: 'warning', message: `"iat" (${formatClaimTime(payload.iat)}) is in the future — clock skew, or a backdated token.` })
  }

  return notes
}

const HMAC_ALGS: Record<string, string> = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }

export function isHmacAlg(alg: string | undefined): boolean {
  return !!alg && alg.toUpperCase() in HMAC_ALGS
}

/** Verifies an HS256/384/512 signature against a shared secret entirely client-side via Web Crypto. */
export async function verifyHmacSignature(signingInput: string, signatureB64: string, secret: string, alg: string): Promise<boolean> {
  const hash = HMAC_ALGS[alg.toUpperCase()]
  if (!hash) throw new Error(`Unsupported algorithm for verification: ${alg}`)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  const computed = new Uint8Array(sig)
  const provided = base64UrlToBytes(signatureB64)
  if (computed.length !== provided.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ provided[i]
  return diff === 0
}
