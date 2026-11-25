/** Parses a curl command line (bash or cmd.exe quoting, line continuations) and renders it in other clients. */

export type CurlRequest = {
  method: string
  url: string
  headers: [string, string][]
  body: string | null
  form: [string, string][]
  basicAuth: [string, string] | null
  insecure: boolean
  compressed: boolean
  followRedirects: boolean
  cookies: string | null
  warnings: string[]
}

export function shellSplit(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, ' ').replace(/\^\r?\n/g, ' ').replace(/`\r?\n/g, ' ')
  const out: string[] = []
  let cur = ''
  let q: '"' | "'" | null = null
  let has = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q === "'") {
      if (c === "'") q = null
      else cur += c
      continue
    }
    if (q === '"') {
      if (c === '\\' && /["\\$`]/.test(s[i + 1] ?? '')) cur += s[++i]
      else if (c === '"') q = null
      else cur += c
      continue
    }
    if (c === '$' && s[i + 1] === "'") {
      // bash ANSI-C quoting $'...'
      let j = i + 2
      let v = ''
      for (; j < s.length && s[j] !== "'"; j++) {
        if (s[j] === '\\') {
          const n = s[++j]
          v += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n
        } else v += s[j]
      }
      cur += v
      has = true
      i = j
      continue
    }
    if (c === "'" || c === '"') {
      q = c
      has = true
      continue
    }
    if (c === '\\' && i + 1 < s.length) {
      cur += s[++i]
      has = true
      continue
    }
    if (/\s/.test(c)) {
      if (cur || has) out.push(cur)
      cur = ''
      has = false
      continue
    }
    cur += c
  }
  if (cur || has) out.push(cur)
  return out
}

export function parseCurl(cmd: string): CurlRequest {
  const args = shellSplit(cmd.trim())
  if (args[0]?.toLowerCase().replace(/\.exe$/, '') === 'curl') args.shift()
  const r: CurlRequest = { method: '', url: '', headers: [], body: null, form: [], basicAuth: null, insecure: false, compressed: false, followRedirects: false, cookies: null, warnings: [] }
  const data: string[] = []
  let get = false
  for (let i = 0; i < args.length; i++) {
    let a = args[i]
    let val: string | undefined
    if (a.startsWith('--') && a.includes('=')) {
      val = a.slice(a.indexOf('=') + 1)
      a = a.slice(0, a.indexOf('='))
    }
    const next = () => val ?? args[++i] ?? ''
    switch (a) {
      case '-X': case '--request': r.method = next().toUpperCase(); break
      case '-H': case '--header': {
        const h = next()
        const idx = h.indexOf(':')
        if (idx > 0) r.headers.push([h.slice(0, idx).trim(), h.slice(idx + 1).trim()])
        break
      }
      case '-d': case '--data': case '--data-ascii': case '--data-binary': case '--data-raw': {
        const d = next()
        if (d.startsWith('@') && a !== '--data-raw') r.warnings.push(`Body is read from file ${d.slice(1)} — inlined as a placeholder`)
        data.push(d)
        break
      }
      case '--data-urlencode': {
        const d = next()
        const eq = d.indexOf('=')
        data.push(eq >= 0 ? `${d.slice(0, eq)}=${encodeURIComponent(d.slice(eq + 1))}` : encodeURIComponent(d))
        break
      }
      case '--json': data.push(next()); r.headers.push(['Content-Type', 'application/json'], ['Accept', 'application/json']); break
      case '-F': case '--form': {
        const f = next()
        const eq = f.indexOf('=')
        r.form.push(eq >= 0 ? [f.slice(0, eq), f.slice(eq + 1)] : [f, ''])
        break
      }
      case '-u': case '--user': {
        const u = next()
        const c = u.indexOf(':')
        r.basicAuth = c >= 0 ? [u.slice(0, c), u.slice(c + 1)] : [u, '']
        break
      }
      case '-b': case '--cookie': r.cookies = next(); break
      case '-A': case '--user-agent': r.headers.push(['User-Agent', next()]); break
      case '-e': case '--referer': r.headers.push(['Referer', next()]); break
      case '-k': case '--insecure': r.insecure = true; break
      case '--compressed': r.compressed = true; break
      case '-L': case '--location': r.followRedirects = true; break
      case '-G': case '--get': get = true; break
      case '-I': case '--head': r.method = 'HEAD'; break
      case '--url': r.url = next(); break
      case '-o': case '--output': case '-w': case '--write-out': case '--connect-timeout': case '-m': case '--max-time': case '--retry': case '-x': case '--proxy': case '--cacert': case '--cert': case '--key': case '-c': case '--cookie-jar': case '-T': case '--upload-file':
        if (a === '-x' || a === '--proxy') r.warnings.push(`Proxy ${next()} ignored`)
        else next()
        break
      case '-s': case '--silent': case '-S': case '--show-error': case '-v': case '--verbose': case '-i': case '--include': case '-f': case '--fail': case '--http1.1': case '--http2': case '-#': break
      default:
        if (a.startsWith('-') && a.length > 1) {
          // combined short flags like -sSLk
          if (/^-[sSLkvif]+$/.test(a)) {
            if (a.includes('k')) r.insecure = true
            if (a.includes('L')) r.followRedirects = true
          } else r.warnings.push(`Ignored option ${a}`)
        } else if (!r.url) r.url = a
    }
  }
  if (data.length) {
    if (get) {
      r.url += (r.url.includes('?') ? '&' : '?') + data.join('&')
    } else r.body = data.join('&')
  }
  if (!r.method) r.method = r.body !== null || r.form.length ? 'POST' : 'GET'
  if (r.body !== null && !r.headers.some(([k]) => k.toLowerCase() === 'content-type') && !r.form.length) {
    r.headers.push(['Content-Type', looksJson(r.body) ? 'application/json' : 'application/x-www-form-urlencoded'])
    if (looksJson(r.body)) r.warnings.push('No Content-Type was given; curl would send form-encoded, but the body looks like JSON so application/json was assumed')
  }
  if (r.cookies) r.headers.push(['Cookie', r.cookies])
  if (!r.url) r.warnings.push('No URL found')
  return r
}

function looksJson(s: string): boolean {
  const t = s.trim()
  if (!/^[[{]/.test(t)) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

const js = (s: string) => JSON.stringify(s)
const py = (s: string) => (s.includes('\n') ? `"""${s.replace(/"""/g, '\\"""')}"""` : JSON.stringify(s))
const java = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

function authHeader(r: CurlRequest): [string, string] | null {
  return r.basicAuth ? ['Authorization', `Basic ${btoa(`${r.basicAuth[0]}:${r.basicAuth[1]}`)}`] : null
}

export type Target = 'fetch' | 'axios' | 'python' | 'java' | 'spring' | 'go' | 'httpie' | 'powershell' | 'curl'

export const TARGETS: { id: Target; label: string }[] = [
  { id: 'fetch', label: 'JS fetch' },
  { id: 'axios', label: 'axios' },
  { id: 'python', label: 'Python requests' },
  { id: 'java', label: 'Java HttpClient' },
  { id: 'spring', label: 'Spring RestClient' },
  { id: 'go', label: 'Go net/http' },
  { id: 'httpie', label: 'HTTPie' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'curl', label: 'curl (normalised)' },
]

export function render(r: CurlRequest, target: Target): string {
  const headers = [...r.headers, ...(authHeader(r) ? [authHeader(r)!] : [])]
  const jsonBody = r.body && looksJson(r.body) ? JSON.parse(r.body) : null
  switch (target) {
    case 'fetch': {
      const opts: string[] = [`  method: ${js(r.method)},`]
      if (headers.length) opts.push(`  headers: {\n${headers.map(([k, v]) => `    ${js(k)}: ${js(v)},`).join('\n')}\n  },`)
      if (r.form.length) return `const form = new FormData()\n${r.form.map(([k, v]) => `form.append(${js(k)}, ${v.startsWith('@') ? `/* file: ${v.slice(1)} */ fileInput.files[0]` : js(v)})`).join('\n')}\n\nconst res = await fetch(${js(r.url)}, {\n${opts.join('\n')}\n  body: form,\n})\nconst data = await res.json()`
      if (r.body !== null) opts.push(`  body: ${jsonBody ? `JSON.stringify(${JSON.stringify(jsonBody, null, 2).replace(/\n/g, '\n  ')})` : js(r.body)},`)
      return `const res = await fetch(${js(r.url)}, {\n${opts.join('\n')}\n})\nconst data = await res.json()`
    }
    case 'axios': {
      const lines = [`  method: ${js(r.method.toLowerCase())},`, `  url: ${js(r.url)},`]
      const h = r.headers
      if (h.length) lines.push(`  headers: {\n${h.map(([k, v]) => `    ${js(k)}: ${js(v)},`).join('\n')}\n  },`)
      if (r.basicAuth) lines.push(`  auth: { username: ${js(r.basicAuth[0])}, password: ${js(r.basicAuth[1])} },`)
      if (r.body !== null) lines.push(`  data: ${jsonBody ? JSON.stringify(jsonBody, null, 2).replace(/\n/g, '\n  ') : js(r.body)},`)
      if (r.followRedirects === false) lines.push('  maxRedirects: 0,')
      return `import axios from 'axios'\n\nconst { data } = await axios({\n${lines.join('\n')}\n})`
    }
    case 'python': {
      const out = ['import requests', '']
      if (r.headers.length) out.push(`headers = {\n${r.headers.map(([k, v]) => `    ${py(k)}: ${py(v)},`).join('\n')}\n}`)
      if (jsonBody) out.push(`payload = ${JSON.stringify(jsonBody, null, 4).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')}`)
      else if (r.body !== null) out.push(`data = ${py(r.body)}`)
      if (r.form.length) out.push(`files = {\n${r.form.map(([k, v]) => `    ${py(k)}: ${v.startsWith('@') ? `open(${py(v.slice(1))}, "rb")` : `(None, ${py(v)})`},`).join('\n')}\n}`)
      const args = [py(r.url)]
      if (r.headers.length) args.push('headers=headers')
      if (jsonBody) args.push('json=payload')
      else if (r.body !== null) args.push('data=data')
      if (r.form.length) args.push('files=files')
      if (r.basicAuth) args.push(`auth=(${py(r.basicAuth[0])}, ${py(r.basicAuth[1])})`)
      if (r.insecure) args.push('verify=False')
      if (r.method === 'GET' && !r.followRedirects) {
        /* requests follows by default for GET — curl doesn't, but most people want it */
      }
      out.push('', `response = requests.${['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(r.method) ? r.method.toLowerCase() : 'request'}(${r.method && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(r.method) ? `${py(r.method)}, ` : ''}${args.join(', ')})`, 'response.raise_for_status()', 'print(response.json())')
      return out.join('\n')
    }
    case 'java': {
      const hdr = headers.map(([k, v]) => `        .header(${java(k)}, ${java(v)})`).join('\n')
      const pub = r.body !== null ? `HttpRequest.BodyPublishers.ofString(${java(r.body)})` : 'HttpRequest.BodyPublishers.noBody()'
      return `import java.net.URI;\nimport java.net.http.*;\n\nHttpClient client = HttpClient.newBuilder()\n        .followRedirects(HttpClient.Redirect.${r.followRedirects ? 'NORMAL' : 'NEVER'})\n        .build();\n\nHttpRequest request = HttpRequest.newBuilder()\n        .uri(URI.create(${java(r.url)}))\n${hdr ? hdr + '\n' : ''}        .method(${java(r.method)}, ${pub})\n        .build();\n\nHttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.statusCode() + " " + response.body());${r.insecure ? '\n// NOTE: curl used -k (insecure). Configure an SSLContext only for trusted internal hosts.' : ''}${r.form.length ? '\n// NOTE: multipart form fields are not rendered for HttpClient — use a multipart library.' : ''}`
    }
    case 'spring': {
      const hdr = headers.map(([k, v]) => `        .header(${java(k)}, ${java(v)})`).join('\n')
      const m = r.method.toLowerCase()
      const std = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(m)
      return `RestClient restClient = RestClient.create();\n\nString body = restClient.${std ? m : `method(HttpMethod.valueOf(${java(r.method)}))`}${std ? '()' : ''}\n        .uri(${java(r.url)})\n${hdr ? hdr + '\n' : ''}${r.body !== null ? `        .body(${java(r.body)})\n` : ''}        .retrieve()\n        .body(String.class);`
    }
    case 'go': {
      const hdr = headers.map(([k, v]) => `\treq.Header.Set(${js(k)}, ${js(v)})`).join('\n')
      return `package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"net/http"${r.body !== null ? '\n\t"strings"' : ''}\n)\n\nfunc main() {\n\t${r.body !== null ? `body := strings.NewReader(${'`'}${r.body.replace(/`/g, '` + "`" + `')}${'`'})\n\t` : ''}req, err := http.NewRequest(${js(r.method)}, ${js(r.url)}, ${r.body !== null ? 'body' : 'nil'})\n\tif err != nil {\n\t\tpanic(err)\n\t}\n${hdr}${hdr ? '\n' : ''}\tresp, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer resp.Body.Close()\n\tb, _ := io.ReadAll(resp.Body)\n\tfmt.Println(resp.StatusCode, string(b))\n}`
    }
    case 'httpie': {
      const parts = ['http']
      if (r.insecure) parts.push('--verify=no')
      if (r.followRedirects) parts.push('--follow')
      if (r.basicAuth) parts.push(`-a ${sh(`${r.basicAuth[0]}:${r.basicAuth[1]}`)}`)
      parts.push(r.method, sh(r.url))
      for (const [k, v] of r.headers) parts.push(sh(`${k}:${v}`))
      const cmd = parts.join(' ')
      return r.body !== null ? `echo ${sh(r.body)} | ${cmd}` : cmd
    }
    case 'powershell': {
      const h = headers.length ? `$headers = @{\n${headers.map(([k, v]) => `    ${js(k)} = ${js(v)}`).join('\n')}\n}\n` : ''
      return `${h}$response = Invoke-RestMethod -Uri ${js(r.url)} -Method ${r.method}${headers.length ? ' -Headers $headers' : ''}${r.body !== null ? ` -Body '${r.body.replace(/'/g, "''")}'` : ''}${r.insecure ? ' -SkipCertificateCheck' : ''}\n$response | ConvertTo-Json -Depth 10`
    }
    case 'curl': {
      const parts = [`curl -X ${r.method} ${sh(r.url)}`]
      for (const [k, v] of r.headers) parts.push(`-H ${sh(`${k}: ${v}`)}`)
      if (r.basicAuth) parts.push(`-u ${sh(`${r.basicAuth[0]}:${r.basicAuth[1]}`)}`)
      if (r.body !== null) parts.push(`--data-raw ${sh(r.body)}`)
      for (const [k, v] of r.form) parts.push(`-F ${sh(`${k}=${v}`)}`)
      if (r.insecure) parts.push('-k')
      if (r.followRedirects) parts.push('-L')
      if (r.compressed) parts.push('--compressed')
      return parts.join(' \\\n  ')
    }
  }
}
