import * as yaml from 'js-yaml'

/** Multi-document Kubernetes manifest linter: workload hygiene, probes, resources, security, cross-references. */

export type KFinding = { level: 'error' | 'warn' | 'info'; resource: string; message: string }
export type KResource = { kind: string; name: string; namespace?: string; apiVersion?: string; doc: Record<string, unknown>; index: number }
export type KImage = { resource: string; container: string; image: string }

type Obj = Record<string, unknown>
const o = (x: unknown): Obj => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {})
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])

export function lintManifests(src: string): { resources: KResource[]; findings: KFinding[]; images: KImage[]; parseError?: string } {
  let docs: unknown[] = []
  try {
    docs = yaml.loadAll(src).filter((d) => d != null)
  } catch (e) {
    return { resources: [], findings: [], images: [], parseError: e instanceof Error ? e.message : 'YAML parse error' }
  }
  // unwrap List kinds
  const flat: unknown[] = []
  for (const d of docs) {
    const od = o(d)
    if (od.kind === 'List' && Array.isArray(od.items)) flat.push(...od.items)
    else flat.push(d)
  }
  const resources: KResource[] = flat.map((d, i) => {
    const od = o(d)
    const md = o(od.metadata)
    return { kind: String(od.kind ?? '?'), name: String(md.name ?? '(unnamed)'), namespace: md.namespace as string | undefined, apiVersion: od.apiVersion as string | undefined, doc: od, index: i }
  })
  const findings: KFinding[] = []
  const images: KImage[] = []
  const id = (r: KResource) => `${r.kind}/${r.name}`
  const add = (level: KFinding['level'], r: KResource, message: string) => findings.push({ level, resource: id(r), message })

  const services = resources.filter((r) => r.kind === 'Service')
  const configMaps = new Set(resources.filter((r) => r.kind === 'ConfigMap').map((r) => r.name))
  const secrets = new Set(resources.filter((r) => r.kind === 'Secret').map((r) => r.name))
  const workloadLabels: { r: KResource; labels: Obj }[] = []

  for (const r of resources) {
    if (!r.apiVersion) add('error', r, 'Missing apiVersion.')
    if (r.name === '(unnamed)') add('error', r, 'Missing metadata.name.')
    const spec = o(r.doc.spec)
    let pod: Obj | null = null
    let podLabels: Obj = {}
    if (['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet'].includes(r.kind)) {
      const tpl = o(spec.template)
      pod = o(tpl.spec)
      podLabels = o(o(tpl.metadata).labels)
      const sel = o(o(spec.selector).matchLabels)
      for (const [k, v] of Object.entries(sel)) if (podLabels[k] !== v) add('error', r, `selector.matchLabels ${k}=${v} doesn't match the pod template labels — the controller will never own its pods.`)
      if (r.kind !== 'DaemonSet') {
        const rep = spec.replicas
        if (rep === 1) add('warn', r, 'replicas: 1 — a single pod means downtime on every node drain or rollout.')
        if (rep === undefined && r.kind === 'Deployment') add('info', r, 'replicas not set (defaults to 1) — fine if an HPA manages it.')
      }
      if (r.kind === 'Deployment' && o(spec.strategy).type === 'Recreate') add('info', r, 'strategy: Recreate causes downtime during rollouts.')
      workloadLabels.push({ r, labels: podLabels })
    } else if (r.kind === 'CronJob') {
      pod = o(o(o(o(spec.jobTemplate).spec).template).spec)
      if (!spec.concurrencyPolicy) add('info', r, 'No concurrencyPolicy — overlapping runs are allowed by default.')
    } else if (r.kind === 'Job') pod = o(o(spec.template).spec)
    else if (r.kind === 'Pod') pod = spec

    if (pod) {
      const containers = [...arr(pod.containers), ...arr(pod.initContainers)].map(o)
      if (pod.hostNetwork) add('warn', r, 'hostNetwork: true shares the node network namespace.')
      if (pod.hostPID) add('warn', r, 'hostPID: true lets the pod see every process on the node.')
      const psc = o(pod.securityContext)
      for (const c of containers) {
        const cname = String(c.name ?? '?')
        const image = String(c.image ?? '')
        images.push({ resource: id(r), container: cname, image })
        const tag = image.includes('@') ? 'digest' : image.split('/').pop()?.split(':')[1]
        if (!image) add('error', r, `container ${cname} has no image.`)
        else if (!tag) add('warn', r, `container ${cname}: image "${image}" has no tag (means :latest).`)
        else if (tag === 'latest') add('warn', r, `container ${cname}: image uses :latest — deployments aren't reproducible and rollbacks lie.`)
        const res = o(c.resources)
        const req = o(res.requests)
        const lim = o(res.limits)
        if (!req.cpu || !req.memory) add('warn', r, `container ${cname}: missing resources.requests (${[!req.cpu && 'cpu', !req.memory && 'memory'].filter(Boolean).join(', ')}) — the scheduler can't place it sensibly.`)
        if (!lim.memory) add('warn', r, `container ${cname}: no memory limit — one leak can OOM the whole node.`)
        const isInit = arr(pod.initContainers).includes(c)
        if (!isInit && ['Deployment', 'StatefulSet', 'DaemonSet'].includes(r.kind)) {
          if (!c.readinessProbe) add('warn', r, `container ${cname}: no readinessProbe — traffic arrives before the app is ready.`)
          if (!c.livenessProbe) add('info', r, `container ${cname}: no livenessProbe — a hung process is never restarted.`)
        }
        const sc = o(c.securityContext)
        if (sc.privileged) add('error', r, `container ${cname}: privileged: true.`)
        if (sc.allowPrivilegeEscalation !== false) add('info', r, `container ${cname}: set securityContext.allowPrivilegeEscalation: false.`)
        if (!sc.runAsNonRoot && !psc.runAsNonRoot && sc.runAsUser !== undefined ? sc.runAsUser === 0 : !sc.runAsNonRoot && !psc.runAsNonRoot)
          add('info', r, `container ${cname}: runAsNonRoot not set — it may run as root.`)
        for (const e of arr(c.env).map(o)) {
          if (typeof e.value === 'string' && /(pass|secret|token|apikey|api_key)/i.test(String(e.name)) && e.value) add('error', r, `container ${cname}: env ${e.name} holds a literal secret — use a Secret + valueFrom.secretKeyRef.`)
          const cmRef = o(o(e.valueFrom).configMapKeyRef).name
          const sRef = o(o(e.valueFrom).secretKeyRef).name
          if (cmRef && configMaps.size && !configMaps.has(String(cmRef))) add('info', r, `container ${cname}: references ConfigMap ${cmRef}, not defined in these manifests.`)
          if (sRef && secrets.size && !secrets.has(String(sRef))) add('info', r, `container ${cname}: references Secret ${sRef}, not defined in these manifests.`)
        }
        if (/:latest$|^[^:@]+$/.test(image) && c.imagePullPolicy === 'IfNotPresent') add('warn', r, `container ${cname}: :latest with imagePullPolicy IfNotPresent — nodes keep running stale images.`)
      }
    }
    if (r.kind === 'Secret' && r.doc.data) {
      add('info', r, 'Secret data is base64, not encrypted — keep this file out of git (use SealedSecrets / External Secrets).')
    }
    if (r.kind === 'Ingress') {
      const rules = arr(spec.rules).map(o)
      for (const rule of rules) {
        for (const p of arr(o(rule.http).paths).map(o)) {
          const svc = o(o(p.backend).service).name ?? o(p.backend).serviceName
          if (svc && services.length && !services.some((s) => s.name === svc)) add('warn', r, `routes to Service ${svc}, which isn't in these manifests.`)
        }
      }
      if (!arr(spec.tls).length) add('info', r, 'No tls section — served over plain HTTP.')
    }
    if (r.apiVersion && /^(extensions\/v1beta1|apps\/v1beta[12]|networking\.k8s\.io\/v1beta1|policy\/v1beta1|batch\/v1beta1)$/.test(r.apiVersion)) add('error', r, `apiVersion ${r.apiVersion} was removed from Kubernetes — upgrade it.`)
  }
  for (const s of services) {
    const sel = o(o(s.doc.spec).selector)
    if (!Object.keys(sel).length) continue
    if (workloadLabels.length && !workloadLabels.some((w) => Object.entries(sel).every(([k, v]) => w.labels[k] === v))) add('warn', s, `selector ${JSON.stringify(sel)} matches no workload in these manifests — the Service will have no endpoints.`)
  }
  return { resources, findings, images }
}

export const SAMPLE_MANIFEST = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: order-uat
spec:
  replicas: 1
  selector:
    matchLabels: { app: order-service }
  template:
    metadata:
      labels: { app: order-service }
    spec:
      containers:
        - name: app
          image: registry.local/order-service:latest
          ports: [{ containerPort: 8080 }]
          env:
            - name: DB_PASSWORD
              value: hunter2
          resources:
            requests: { cpu: 250m }
---
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector: { app: orders }
  ports: [{ port: 80, targetPort: 8080 }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: order-service
spec:
  rules:
    - host: orders.uat.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: order-svc, port: { number: 80 } }
`
