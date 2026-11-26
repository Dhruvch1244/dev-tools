/** Heuristic Declarative/Scripted Jenkinsfile reader: stage tree (sequential, parallel, nested) plus lint findings. */

export type JStage = {
  name: string
  start: number
  end: number
  line: number
  parallel: boolean
  children: JStage[]
  hasInput: boolean
  inputMessage?: string
  when?: string
  steps: string[]
  agent?: string
  timeout?: string
  hasPost: boolean
}

export type Finding = { level: 'error' | 'warn' | 'info'; line: number; message: string }

export type JenkinsfileModel = {
  kind: 'declarative' | 'scripted' | 'unknown'
  stages: JStage[]
  parameters: { type: string; name: string; line: number }[]
  environment: string[]
  agent?: string
  options: string[]
  triggers: string[]
  libraries: string[]
  findings: Finding[]
  hasPost: boolean
}

/** Blanks out strings and comments (keeping length & newlines) so brace matching can't be fooled by them. */
function mask(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const r = src.slice(i, i + 3)
    if (r.startsWith('//')) {
      const e = src.indexOf('\n', i)
      const end = e < 0 ? src.length : e
      out += ' '.repeat(end - i)
      i = end
    } else if (r.startsWith('/*')) {
      const e = src.indexOf('*/', i + 2)
      const end = e < 0 ? src.length : e + 2
      out += src.slice(i, end).replace(/[^\n]/g, ' ')
      i = end
    } else if (r === "'''" || r === '"""') {
      const e = src.indexOf(r, i + 3)
      const end = e < 0 ? src.length : e + 3
      out += r + src.slice(i + 3, end - 3).replace(/[^\n]/g, ' ') + r
      i = end
    } else if (src[i] === "'" || src[i] === '"') {
      const q = src[i]
      let j = i + 1
      while (j < src.length && src[j] !== q && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
      out += q + ' '.repeat(Math.max(0, j - i - 1)) + (src[j] === q ? q : '')
      i = src[j] === q ? j + 1 : j
    } else {
      out += src[i]
      i++
    }
  }
  return out
}

function matchBrace(m: string, open: number): number {
  let d = 0
  for (let i = open; i < m.length; i++) {
    if (m[i] === '{') d++
    else if (m[i] === '}' && --d === 0) return i
  }
  return m.length - 1
}

function lineAt(src: string, idx: number): number {
  let n = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') n++
  return n
}

export function parseJenkinsfile(src: string): JenkinsfileModel {
  const m = mask(src)
  const findings: Finding[] = []
  const kind: JenkinsfileModel['kind'] = /\bpipeline\s*\{/.test(m) ? 'declarative' : /\bnode\s*(\([^)]*\))?\s*\{|\bstage\s*\(/.test(m) ? 'scripted' : 'unknown'

  const flat: JStage[] = []
  const re = /\bstage\s*\(\s*(['"])(.*?)\1\s*\)\s*\{/g
  let mm: RegExpExecArray | null
  while ((mm = re.exec(src))) {
    const open = mm.index + mm[0].length - 1
    if (m[open] !== '{') continue
    const end = matchBrace(m, open)
    flat.push({ name: mm[2], start: mm.index, end, line: lineAt(src, mm.index), parallel: false, children: [], hasInput: false, steps: [], hasPost: false })
  }
  // nest by containment
  const roots: JStage[] = []
  const stack: JStage[] = []
  for (const s of flat.sort((a, b) => a.start - b.start)) {
    while (stack.length && stack[stack.length - 1].end < s.start) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(s)
    else roots.push(s)
    stack.push(s)
  }
  // body analysis excluding child stage bodies
  const own = (s: JStage) => {
    let body = src.slice(s.start, s.end + 1)
    for (const c of [...s.children].sort((a, b) => b.start - a.start)) body = body.slice(0, c.start - s.start) + ' '.repeat(c.end - c.start + 1) + body.slice(c.end - s.start + 1)
    return body
  }
  const visit = (s: JStage) => {
    const body = own(s)
    s.parallel = /\bparallel\s*(\{|\()/.test(body) || /\bparallel\s*\(/.test(body)
    const input = /\binput\s*(\(|\{)?\s*(?:message\s*:\s*)?(['"])(.*?)\2/.exec(body)
    if (/\binput\s*[({]/.test(body) || input) {
      s.hasInput = true
      s.inputMessage = input?.[3]
    }
    const whenAt = /\bwhen\s*\{/.exec(mask(body))
    if (whenAt) {
      const mb = mask(body)
      const close = matchBrace(mb, whenAt.index + whenAt[0].length - 1)
      s.when = body.slice(whenAt.index + whenAt[0].length, close).trim().replace(/\s+/g, ' ').slice(0, 120)
    }
    const agent = /\bagent\s*\{?\s*(any|none|label\s+['"][^'"]+['"]|docker\s*\{?[^}\n]*|kubernetes|\{)/.exec(body)
    if (agent) s.agent = agent[1].replace(/\s+/g, ' ')
    const to = /timeout\s*\(\s*(?:time\s*:\s*)?(\d+)[^)]*?(?:unit\s*:\s*['"]?(\w+))?/.exec(body)
    if (to) s.timeout = `${to[1]} ${to[2]?.toLowerCase() ?? 'minutes'}`
    s.hasPost = /\bpost\s*\{/.test(body)
    const stepRe = /(?:^|[\s{;(])(sh|bat|powershell|echo|script|withCredentials|withEnv|dir|checkout|git|archiveArtifacts|junit|build|input|timeout|retry|sleep|stash|unstash|container|withKubeConfig|withMaven|withDockerRegistry|readFile|writeFile)\b(?=\s*[('"{[$]|\s+[\w$])/g
    let st: RegExpExecArray | null
    const seen: string[] = []
    const maskedBody = mask(body)
    while ((st = stepRe.exec(maskedBody)) && seen.length < 14) seen.push(st[1])
    s.steps = seen
    // lint per stage
    if (s.hasInput && !s.timeout && !/timeout/.test(src.slice(Math.max(0, s.start - 200), s.start)))
      findings.push({ level: 'warn', line: s.line, message: `Stage "${s.name}" waits for input with no timeout — an unanswered approval holds an executor forever. Wrap it in timeout(time: 1, unit: 'HOURS').` })
    if (s.hasInput && /\bagent\s*\{?\s*(any|label)/.test(body))
      findings.push({ level: 'info', line: s.line, message: `Stage "${s.name}" has an input step and its own agent — use agent none on the input stage so the approval doesn't block a node.` })
    if (/\bsh\s+['"].*\b(password|passwd|token|secret)\s*=\s*[^$\s'"]+/i.test(src.slice(s.start, s.end)))
      findings.push({ level: 'error', line: s.line, message: `Stage "${s.name}" seems to inline a secret in a shell command — use withCredentials.` })
    if (/\bset\s+-x\b/.test(src.slice(s.start, s.end)))
      findings.push({ level: 'info', line: s.line, message: `Stage "${s.name}" enables set -x; any credential in those lines will be echoed to the log.` })
    s.children.forEach(visit)
  }
  roots.forEach(visit)

  const parameters: JenkinsfileModel['parameters'] = []
  const pBlock = /\bparameters\s*\{/.exec(m)
  if (pBlock) {
    const end = matchBrace(m, pBlock.index + pBlock[0].length - 1)
    const body = src.slice(pBlock.index, end)
    const pr = /\b(string|booleanParam|choice|text|password|run|file|credentials)\s*\(\s*(?:[^)]*?\bname\s*:\s*['"]([^'"]+)['"])/g
    let p: RegExpExecArray | null
    while ((p = pr.exec(body))) parameters.push({ type: p[1], name: p[2], line: lineAt(src, pBlock.index + p.index) })
  }
  const environment: string[] = []
  const eBlock = /\benvironment\s*\{/.exec(m)
  if (eBlock) {
    const end = matchBrace(m, eBlock.index + eBlock[0].length - 1)
    for (const l of src.slice(eBlock.index + eBlock[0].length, end).split('\n')) {
      const e = /^\s*([A-Za-z_]\w*)\s*=\s*(.+?)\s*$/.exec(l)
      if (e) {
        environment.push(`${e[1]} = ${e[2]}`)
        if (/(PASSWORD|SECRET|TOKEN|API_KEY)/i.test(e[1]) && !/credentials\(/.test(e[2]))
          findings.push({ level: 'error', line: lineAt(src, src.indexOf(l)), message: `${e[1]} looks like a secret set as a plain string — use credentials('id').` })
      }
    }
  }
  const options: string[] = []
  const oBlock = /\boptions\s*\{/.exec(m)
  if (oBlock) {
    const end = matchBrace(m, oBlock.index + oBlock[0].length - 1)
    for (const l of src.slice(oBlock.index + oBlock[0].length, end).split('\n')) if (l.trim()) options.push(l.trim())
  }
  const triggers: string[] = []
  const tBlock = /\btriggers\s*\{/.exec(m)
  if (tBlock) {
    const end = matchBrace(m, tBlock.index + tBlock[0].length - 1)
    for (const l of src.slice(tBlock.index + tBlock[0].length, end).split('\n')) if (l.trim()) triggers.push(l.trim())
  }
  const libraries = [...src.matchAll(/@Library\s*\(\s*['"]([^'"]+)['"]/g)].map((x) => x[1])
  const topAgent = /pipeline\s*\{\s*agent\s+(\w+|\{[^}]*\})/.exec(src)?.[1]

  if (kind === 'declarative') {
    if (!options.some((o) => /timeout/.test(o))) findings.push({ level: 'warn', line: 1, message: 'No pipeline-level timeout in options {} — a hung step can hold an executor indefinitely.' })
    if (!options.some((o) => /buildDiscarder|logRotator/.test(o))) findings.push({ level: 'info', line: 1, message: 'No buildDiscarder — old builds and logs pile up on the controller.' })
    if (!options.some((o) => /disableConcurrentBuilds/.test(o)) && roots.some((s) => /deploy|release|prod/i.test(s.name)))
      findings.push({ level: 'info', line: 1, message: 'Deploy pipeline without disableConcurrentBuilds() — two runs can deploy over each other.' })
    if (!/\bpost\s*\{/.test(m)) findings.push({ level: 'info', line: 1, message: 'No post {} section — nothing notifies anyone when this fails.' })
    if (topAgent === 'any') findings.push({ level: 'info', line: lineAt(src, src.indexOf('agent any')), message: 'agent any runs on whatever node is free, including the built-in node; pin a label.' })
  }
  if (/\bcurrentBuild\.result\s*=\s*['"]SUCCESS/.test(src)) findings.push({ level: 'warn', line: lineAt(src, src.search(/currentBuild\.result/)), message: 'Forcing currentBuild.result = SUCCESS hides real failures.' })
  if (/catchError\s*\(\s*\)|catch\s*\(\s*\w+\s*\)\s*\{\s*\}/.test(src)) findings.push({ level: 'warn', line: lineAt(src, src.search(/catchError\s*\(\s*\)|catch\s*\(\s*\w+\s*\)\s*\{\s*\}/)), message: 'An exception is swallowed (empty catch / bare catchError).' })
  if (/\$\{?env\.BRANCH_NAME\}?\s*==\s*['"]master['"]/.test(src)) findings.push({ level: 'info', line: lineAt(src, src.search(/BRANCH_NAME/)), message: "Branch check against 'master' — is the default branch 'main' now?" })
  if (roots.length === 0) findings.push({ level: 'info', line: 1, message: 'No stage(...) blocks found.' })

  return { kind, stages: roots, parameters, environment, agent: topAgent, options, triggers, libraries, findings: findings.sort((a, b) => a.line - b.line), hasPost: /\bpost\s*\{/.test(m) }
}

export const SAMPLE_JENKINSFILE = `@Library('platform-shared@v4') _

pipeline {
  agent { label 'linux-docker' }
  options {
    buildDiscarder(logRotator(numToKeepStr: '30'))
    timestamps()
  }
  parameters {
    string(name: 'VERSION', defaultValue: '', description: 'Artifact version from CI')
    choice(name: 'ENV', choices: ['DIT', 'UAT', 'PROD'], description: 'Target environment')
    booleanParam(name: 'DRY_RUN', defaultValue: false)
  }
  environment {
    CHART = 'charts/order-service'
    REGISTRY_CREDS = credentials('registry-push')
  }
  stages {
    stage('Prepare') {
      steps {
        checkout scm
        sh 'helm lint $CHART'
      }
    }
    stage('Quality') {
      parallel {
        stage('Unit') { steps { sh './mvnw -B test' } }
        stage('Sonar') { steps { sh './mvnw -B sonar:sonar' } }
        stage('Trivy') { steps { sh 'trivy fs --exit-code 1 .' } }
      }
    }
    stage('Helm Package') {
      steps {
        sh "helm package $CHART --version \${params.VERSION}"
        sh 'helm push *.tgz oci://registry.local/charts'
      }
    }
    stage('Approval') {
      when { expression { params.ENV == 'PROD' } }
      steps {
        input message: "Deploy \${params.VERSION} to \${params.ENV}?", ok: 'Proceed'
      }
    }
    stage('Deploy') {
      steps {
        sh "helm upgrade --install order-service oci://registry.local/charts/order-service --version \${params.VERSION}"
        sh 'echo HELM_TAG=\${params.VERSION}'
      }
    }
  }
  post {
    failure { echo 'notify the team' }
  }
}
`
