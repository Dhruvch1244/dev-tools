import { useMemo, useState } from 'react'
import { Check, ShieldCheck, WarningCircle, X } from '@phosphor-icons/react'
import { analyzeJwt, CLAIM_EXPLANATIONS, decodeJwt, isHmacAlg, verifyHmacSignature, type DecodedJwt } from '../lib/jwt'
import { Panel, SectionLabel, ErrorBanner, Button } from '../components/ui'

const NOTE_STYLE: Record<string, string> = {
  error: 'border-rose/30 bg-rose/[0.06] text-rose',
  warning: 'border-warm/30 bg-warm/[0.06] text-warm',
  info: 'border-cyan/30 bg-cyan/[0.06] text-cyan',
}
const NOTE_ICON: Record<string, React.ElementType> = { error: X, warning: WarningCircle, info: ShieldCheck }

export function JwtInspectorPage() {
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyResult, setVerifyResult] = useState<'valid' | 'invalid' | null>(null)
  const [verifying, setVerifying] = useState(false)

  let decoded: DecodedJwt | null = null
  let parseError: string | null = null
  try {
    if (token.trim()) decoded = decodeJwt(token)
  } catch (e) {
    parseError = e instanceof Error ? e.message : 'Could not decode — not a valid JWT'
  }

  const notes = useMemo(() => (decoded ? analyzeJwt(decoded.header, decoded.payload) : []), [decoded])
  const alg = decoded && typeof decoded.header.alg === 'string' ? decoded.header.alg : undefined
  const canVerify = decoded && isHmacAlg(alg) && !!decoded.signatureB64

  async function verify() {
    if (!decoded || !alg) return
    setVerifying(true)
    setVerifyResult(null)
    try {
      const ok = await verifyHmacSignature(decoded.signingInput, decoded.signatureB64, secret, alg)
      setVerifyResult(ok ? 'valid' : 'invalid')
    } catch {
      setVerifyResult('invalid')
    } finally {
      setVerifying(false)
    }
  }

  const claimEntries = decoded ? Object.entries(decoded.payload) : []

  return (
    <div className="flex h-full gap-4">
      <div className="flex w-[420px] shrink-0 flex-col gap-4">
        <Panel>
          <div className="flex flex-col gap-2 p-4">
            <SectionLabel>Token</SectionLabel>
            <textarea
              value={token}
              onChange={(e) => { setToken(e.target.value); setVerifyResult(null) }}
              spellCheck={false}
              placeholder="eyJhbGciOiJI..."
              className="h-40 resize-none rounded-2xl border border-rule bg-panel p-3.5 font-mono text-[12px] text-ink outline-none focus:border-cyan/50"
            />
            <div className="text-[11px] text-ink-faint">
              Decoded entirely in your browser — the token never leaves this page.
            </div>
            {parseError && <ErrorBanner message={parseError} />}
          </div>
        </Panel>

        {decoded && (
          <Panel className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col gap-2 overflow-auto p-4">
              <SectionLabel>Signature verification</SectionLabel>
              {canVerify ? (
                <>
                  <div className="text-[11px] text-ink-faint">{alg} — paste the shared secret to verify.</div>
                  <input
                    className="devtools-input font-mono text-xs"
                    type="password"
                    placeholder="shared secret"
                    value={secret}
                    onChange={(e) => { setSecret(e.target.value); setVerifyResult(null) }}
                  />
                  <Button variant="primary" onClick={verify} disabled={!secret || verifying}>
                    {verifying ? 'Verifying…' : 'Verify'}
                  </Button>
                  {verifyResult && (
                    <div className={`flex items-center gap-1.5 text-sm font-medium ${verifyResult === 'valid' ? 'text-emerald' : 'text-rose'}`}>
                      {verifyResult === 'valid' ? <Check size={15} weight="bold" /> : <X size={15} weight="bold" />}
                      {verifyResult === 'valid' ? 'Signature valid for this secret' : 'Signature does NOT match this secret'}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-ink-faint">
                  {alg ? `${alg} needs a public/private key pair — verification isn't supported here, only HS256/384/512.` : 'No algorithm to verify against.'}
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto">
        {!decoded && !parseError && (
          <Panel className="flex flex-1 items-center justify-center">
            <div className="text-sm text-ink-faint">Paste a JWT to decode its header, payload, and check for common issues.</div>
          </Panel>
        )}

        {decoded && (
          <>
            {notes.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {notes.map((n, i) => {
                  const Icon = NOTE_ICON[n.severity]
                  return (
                    <div key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] ${NOTE_STYLE[n.severity]}`}>
                      <Icon size={14} weight="bold" className="mt-0.5 shrink-0" />
                      {n.message}
                    </div>
                  )
                })}
              </div>
            )}

            <Panel>
              <div className="p-4">
                <SectionLabel>Header</SectionLabel>
                <pre className="max-h-40 overflow-auto rounded-2xl border border-rule bg-panel p-3 font-mono text-[12.5px] text-ink">
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
              </div>
            </Panel>

            <Panel className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-auto p-4">
                <SectionLabel>Claims</SectionLabel>
                <div className="flex flex-col gap-1">
                  {claimEntries.map(([k, v]) => (
                    <div key={k} className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-glass">
                      <span className="w-16 shrink-0 font-mono text-[11.5px] font-semibold text-cyan">{k}</span>
                      <span className="w-56 shrink-0 break-all font-mono text-[11.5px] text-ink">
                        {['exp', 'nbf', 'iat'].includes(k) && typeof v === 'number' ? `${v} (${new Date(v * 1000).toLocaleString()})` : JSON.stringify(v)}
                      </span>
                      <span className="flex-1 text-[11px] text-ink-faint">{CLAIM_EXPLANATIONS[k] ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}
