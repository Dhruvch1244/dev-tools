/** Dockerfile parser + best-practice linter (hadolint-inspired rules, implemented from scratch). */

export type DInstr = { line: number; cmd: string; args: string; stage: number }
export type DStage = { index: number; name?: string; base: string; line: number; instructions: DInstr[] }
export type DFinding = { level: 'error' | 'warn' | 'info'; line: number; rule: string; message: string }

export function parseDockerfile(src: string): { instructions: DInstr[]; stages: DStage[] } {
  const out: DInstr[] = []
  const lines = src.split('\n')
  let buf = ''
  let start = 0
  let stage = -1
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!buf && /^\s*#/.test(raw)) continue
    if (!buf && !raw.trim()) continue
    if (!buf) start = i + 1
    const cont = /\\\s*$/.test(raw)
    buf += (buf ? ' ' : '') + raw.replace(/\\\s*$/, '').trim()
    if (cont) continue
    const m = /^(\w+)\s*(.*)$/.exec(buf.trim())
    if (m) {
      const cmd = m[1].toUpperCase()
      if (cmd === 'FROM') stage++
      out.push({ line: start, cmd, args: m[2], stage: Math.max(0, stage) })
    }
    buf = ''
  }
  const stages: DStage[] = []
  for (const ins of out) {
    if (ins.cmd === 'FROM') {
      const m = /^(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(ins.args)
      stages.push({ index: stages.length, base: m?.[1] ?? ins.args, name: m?.[2], line: ins.line, instructions: [] })
    }
    stages[stages.length - 1]?.instructions.push(ins)
  }
  return { instructions: out, stages }
}

export function lintDockerfile(src: string): { stages: DStage[]; findings: DFinding[] } {
  const { instructions, stages } = parseDockerfile(src)
  const f: DFinding[] = []
  const add = (level: DFinding['level'], line: number, rule: string, message: string) => f.push({ level, line, rule, message })
  const stageNames = new Set(stages.map((s) => s.name?.toLowerCase()).filter(Boolean))
  if (!instructions.length) return { stages, findings: [] }
  if (instructions[0].cmd !== 'FROM' && instructions[0].cmd !== 'ARG') add('error', instructions[0].line, 'DL-FROM', 'A Dockerfile must start with FROM (or ARG before FROM).')

  for (const s of stages) {
    const base = s.base.replace(/^\$\{?\w+\}?$/, '')
    if (base && !stageNames.has(base.toLowerCase()) && base !== 'scratch') {
      if (!base.includes(':') && !base.includes('@')) add('warn', s.line, 'DL-TAG', `FROM ${s.base} has no tag — it silently means :latest and builds stop being reproducible.`)
      else if (/:latest$/.test(base)) add('warn', s.line, 'DL-LATEST', `FROM ${s.base} pins :latest — pin a version (or a digest) instead.`)
    }
  }

  const last = stages[stages.length - 1]
  let runStreak = 0
  for (let i = 0; i < instructions.length; i++) {
    const ins = instructions[i]
    const a = ins.args
    if (ins.cmd === 'RUN') {
      runStreak = instructions[i - 1]?.cmd === 'RUN' && instructions[i - 1].stage === ins.stage ? runStreak + 1 : 1
      if (runStreak === 3) add('info', ins.line, 'DL-RUNS', 'Three or more consecutive RUN instructions — chain them with && to cut layers.')
      if (/apt-get\s+install/.test(a)) {
        if (!/\s-y\b|--yes|--assume-yes/.test(a)) add('error', ins.line, 'DL-APT-Y', 'apt-get install without -y will hang waiting for confirmation.')
        if (!/--no-install-recommends/.test(a)) add('info', ins.line, 'DL-APT-REC', 'Add --no-install-recommends to keep the image small.')
        if (!/rm -rf \/var\/lib\/apt\/lists/.test(a)) add('info', ins.line, 'DL-APT-CLEAN', 'Clean up with rm -rf /var/lib/apt/lists/* in the same RUN.')
        if (!/apt-get update/.test(a)) add('warn', ins.line, 'DL-APT-UPDATE', 'apt-get install without apt-get update in the same RUN uses a stale, cached index.')
      }
      if (/apt-get\s+upgrade|apt-get\s+dist-upgrade/.test(a)) add('warn', ins.line, 'DL-APT-UPGRADE', 'Avoid apt-get upgrade in images; bump the base image instead.')
      if (/apk\s+add/.test(a) && !/--no-cache/.test(a)) add('info', ins.line, 'DL-APK', 'apk add without --no-cache leaves the index in the layer.')
      if (/pip3?\s+install/.test(a) && !/--no-cache-dir/.test(a)) add('info', ins.line, 'DL-PIP', 'pip install without --no-cache-dir bloats the layer.')
      if (/\bnpm\s+install\b/.test(a) && !/-g\b/.test(a)) add('info', ins.line, 'DL-NPM', 'Prefer npm ci for reproducible installs from package-lock.json.')
      if (/(curl|wget)[^|]*\|\s*(ba)?sh/.test(a)) add('warn', ins.line, 'DL-PIPE-SH', 'Piping a download straight into a shell — verify a checksum first.')
      if (/\bsudo\b/.test(a)) add('warn', ins.line, 'DL-SUDO', "Don't use sudo in RUN; set USER appropriately instead.")
      if (/(^|&&|;)\s*cd\s+\S+/.test(a)) add('info', ins.line, 'DL-CD', 'Use WORKDIR instead of cd in RUN.')
      if (/\bchmod\s+(-R\s+)?777\b/.test(a)) add('warn', ins.line, 'DL-777', 'chmod 777 makes files world-writable.')
    } else runStreak = 0
    if (ins.cmd === 'ADD' && !/^(--\S+\s+)*(https?:\/\/|\S+\.(tar|tgz|tar\.gz|tar\.xz|zip)\b)/.test(a)) add('warn', ins.line, 'DL-ADD', 'Use COPY instead of ADD for local files — ADD also auto-extracts and fetches URLs.')
    if (ins.cmd === 'MAINTAINER') add('info', ins.line, 'DL-MAINTAINER', 'MAINTAINER is deprecated — use LABEL maintainer="…".')
    if ((ins.cmd === 'ENV' || ins.cmd === 'ARG') && /\b\w*(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)\w*\s*[= ]\s*\S+/i.test(a))
      add('error', ins.line, 'DL-SECRET', `${ins.cmd} appears to bake a secret into the image (visible via docker history). Use build secrets (RUN --mount=type=secret).`)
    if ((ins.cmd === 'CMD' || ins.cmd === 'ENTRYPOINT') && !a.trim().startsWith('[')) add('info', ins.line, 'DL-SHELL-FORM', `${ins.cmd} in shell form doesn't forward signals (SIGTERM) to your process — prefer the JSON exec form.`)
    if (ins.cmd === 'COPY' && /^(--\S+\s+)*\.\s+\S+/.test(a)) {
      const later = instructions.slice(i + 1).find((x) => x.stage === ins.stage && x.cmd === 'RUN' && /(npm (ci|install)|yarn install|pip install -r|mvn .*(dependency:|package|install)|gradle|go mod download|bundle install)/.test(x.args))
      if (later) add('warn', ins.line, 'DL-CACHE', `COPY . before installing dependencies (line ${later.line}) busts the layer cache on every code change — copy the lockfile first.`)
    }
    if (ins.cmd === 'EXPOSE' && /\b(22)\b/.test(a)) add('warn', ins.line, 'DL-SSH', 'Exposing port 22 — SSH in containers is usually a smell.')
    if (ins.cmd === 'WORKDIR' && !/^["']?(\/|\$|[A-Za-z]:)/.test(a)) add('warn', ins.line, 'DL-WORKDIR', 'Use an absolute WORKDIR path.')
  }

  if (last) {
    const users = last.instructions.filter((x) => x.cmd === 'USER')
    if (users.length === 0) add('warn', last.line, 'DL-ROOT', 'The final stage never sets USER — the container runs as root.')
    else if (/^(root|0)(:|$)/.test(users[users.length - 1].args.trim())) add('warn', users[users.length - 1].line, 'DL-ROOT', 'The final USER is root.')
    if (!last.instructions.some((x) => x.cmd === 'HEALTHCHECK')) add('info', last.line, 'DL-HEALTH', 'No HEALTHCHECK (fine on Kubernetes, which uses probes instead).')
    if (!last.instructions.some((x) => x.cmd === 'CMD' || x.cmd === 'ENTRYPOINT') && stages.length === 1) add('info', last.line, 'DL-CMD', 'No CMD or ENTRYPOINT in the final stage (inherits the base image\'s).')
  }
  return { stages, findings: f.sort((a, b) => a.line - b.line) }
}

export const SAMPLE_DOCKERFILE = `FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY . .
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre
MAINTAINER platform-team
ENV DB_PASSWORD=supersecret
RUN apt-get update
RUN apt-get install curl
RUN cd /opt && mkdir app
ADD target/app.jar /opt/app/app.jar
COPY --from=build /src/target/*.jar /opt/app/
EXPOSE 8080
CMD java -jar /opt/app/app.jar
`
