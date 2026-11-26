import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BracketsCurly,
  Bug,
  ChartBar,
  ChartPieSlice,
  ClipboardText,
  CloudArrowDown,
  Database,
  Fingerprint,
  FileArrowDown,
  FileCode,
  FileZip,
  GitDiff,
  Globe,
  Hash,
  ListMagnifyingGlass,
  ListNumbers,
  CircleDashed,
  PenNib,
  PaperPlaneTilt,
  House,
  LockKey,
  SidebarSimple,
  MagnifyingGlass,
  CaretDown,
  ArrowsClockwise,
  Robot,
  Table,
  Translate,
  TreeStructure,
  GitBranch,
  GitCommit,
  SquaresFour,
  Shapes,
  Stairs,
  Clock,
  MagicWand,
  Gauge,
  Notebook,
  Percent,
  GitMerge,
  Image,
  FilePdf,
  Key,
  ListChecks,
  ShieldCheck,
  Stack,
  Star,
  Terminal,
  TextAa,
  Warning,
  Wrench,
  X,
  Rocket,
  ArrowsCounterClockwise,
  FlowArrow,
  Sliders,
  Cube,
  Package,
  Tag,
  NetworkSlash,
  Heartbeat,
  Info,
  TerminalWindow,
  LinkSimple,
  Path,
  Code,
  Binary,
  Palette,
  Ruler,
  NotePencil,
  Timer,
  Sparkle,
} from '@phosphor-icons/react'
import { FileSearchPage } from './pages/FileSearchPage'
import { JsonXmlPage } from './pages/JsonXmlPage'
import { ListConverterPage } from './pages/ListConverterPage'
import { SqlPage } from './pages/SqlPage'
import { DiffPage } from './pages/DiffPage'
import { EncodeDecodePage } from './pages/EncodeDecodePage'
import { TimeToolkitPage } from './pages/TimeToolkitPage'
import { RegexLabPage } from './pages/RegexLabPage'
import { TextToolkitPage } from './pages/TextToolkitPage'
import { DataGeneratorPage } from './pages/DataGeneratorPage'
import { VaultPage } from './pages/VaultPage'
import { GitRepoPage } from './pages/GitRepoPage'
import { CommandTemplatesPage } from './pages/CommandTemplatesPage'
import { PlSqlAnalyzerPage } from './pages/PlSqlAnalyzerPage'
import { SvgToolsPage } from './pages/SvgToolsPage'
import { ApiClientPage } from './pages/ApiClientPage'
import { StackTracePage } from './pages/StackTracePage'
import { DependencyTreePage } from './pages/DependencyTreePage'
import { SpringConfigPage } from './pages/SpringConfigPage'
import { JarInspectPage } from './pages/JarInspectPage'
import { BundleStatsPage } from './pages/BundleStatsPage'
import { CorsCheckPage } from './pages/CorsCheckPage'
import { TopAnalyzerPage } from './pages/TopAnalyzerPage'
import { ReferenceHandbookPage } from './pages/ReferenceHandbookPage'
import { NotesPage } from './pages/NotesPage'
import { AvroSchemaPage } from './pages/AvroSchemaPage'
import { AwsHelpersPage } from './pages/AwsHelpersPage'
import { CsvProfilerPage } from './pages/CsvProfilerPage'
import { PartMergePage } from './pages/PartMergePage'
import { ImageToolsPage } from './pages/ImageToolsPage'
import { PdfToolsPage } from './pages/PdfToolsPage'
import { TaskListPage } from './pages/TaskListPage'
import { SpringVizPage } from './pages/SpringVizPage'
import { GitGraphPage } from './pages/GitGraphPage'
import { ChangelogGeneratorPage } from './pages/ChangelogGeneratorPage'
import { DiskTreemapPage } from './pages/DiskTreemapPage'
import { DiagramStudioPage } from './pages/DiagramStudioPage'
import { HomePage } from './pages/HomePage'
import { SystemPage } from './pages/SystemPage'
import { LogTailerPage } from './pages/LogTailerPage'
import { LogPatternMinerPage } from './pages/LogPatternMinerPage'
import { ThreadDumpAnalyzerPage } from './pages/ThreadDumpAnalyzerPage'
import { FormatConverterPage } from './pages/FormatConverterPage'
import { SqlInsertPage } from './pages/SqlInsertPage'
import { SchemaDiffPage } from './pages/SchemaDiffPage'
import { RowDiffPage } from './pages/RowDiffPage'
import { MockServerPage } from './pages/MockServerPage'
import { PostmanImportPage } from './pages/PostmanImportPage'
import { HinglishConverterPage } from './pages/HinglishConverterPage'
import { JacocoViewerPage } from './pages/JacocoViewerPage'
import { JwtInspectorPage } from './pages/JwtInspectorPage'
import { OpenApiImportPage } from './pages/OpenApiImportPage'
import { MigrationTimelinePage } from './pages/MigrationTimelinePage'
import { JenkinsStudioPage } from './pages/JenkinsStudioPage'
import { RehydrationBoardPage } from './pages/RehydrationBoardPage'
import { JenkinsfileVizPage } from './pages/JenkinsfileVizPage'
import { HelmValuesPage } from './pages/HelmValuesPage'
import { K8sLintPage } from './pages/K8sLintPage'
import { DockerfileLintPage } from './pages/DockerfileLintPage'
import { SemverPage } from './pages/SemverPage'
import { CidrPage } from './pages/CidrPage'
import { HealthBoardPage } from './pages/HealthBoardPage'
import { HttpReferencePage } from './pages/HttpReferencePage'
import { CurlConvertPage } from './pages/CurlConvertPage'
import { UrlParserPage } from './pages/UrlParserPage'
import { JsonPathPage } from './pages/JsonPathPage'
import { SqlFormatPage } from './pages/SqlFormatPage'
import { BaseConvertPage } from './pages/BaseConvertPage'
import { ColorStudioPage } from './pages/ColorStudioPage'
import { UnitConvertPage } from './pages/UnitConvertPage'
import { ScratchpadPage } from './pages/ScratchpadPage'
import { FocusTimerPage } from './pages/FocusTimerPage'
import { Backdrop } from './components/Backdrop'
import { CursorFx } from './components/CursorFx'
import { cycleTheme } from './lib/themes'
// lazy: it wildcard-imports every @phosphor-icons/react icon (1500+), which would otherwise
// bloat the main bundle by ~5MB for every page load, not just when this tool is opened.
const IconLibraryPage = lazy(() => import('./pages/IconLibraryPage').then((m) => ({ default: m.IconLibraryPage })))
import { SettingsPopover } from './components/SettingsPopover'
import { CommandPalette, type PaletteItem } from './components/CommandPalette'
import { GlobalSearch } from './components/GlobalSearch'
import { applyFont, getStoredFont } from './lib/fonts'

export type Tool =
  | 'home'
  | 'diagram-studio'
  | 'spring-viz'
  | 'git-graph'
  | 'changelog-generator'
  | 'disk-treemap'
  | 'image-tools'
  | 'pdf-tools'
  | 'task-list'
  | 'file-search'
  | 'json-xml'
  | 'sql'
  | 'list-convert'
  | 'notes'
  | 'avro-schema'
  | 'csv-profiler'
  | 'part-merge'
  | 'diff'
  | 'encode'
  | 'time'
  | 'regex'
  | 'text'
  | 'hinglish-convert'
  | 'data-gen'
  | 'vault'
  | 'git-repo'
  | 'command-templates'
  | 'plsql-analyzer'
  | 'svg-tools'
  | 'api-client'
  | 'stack-trace'
  | 'dep-tree'
  | 'spring-config'
  | 'jar-inspect'
  | 'top-analyzer'
  | 'reference-handbook'
  | 'bundle-stats'
  | 'jacoco-viewer'
  | 'jwt-inspector'
  | 'cors-check'
  | 'aws-helpers'
  | 'system'
  | 'log-tailer'
  | 'log-pattern-miner'
  | 'thread-dump'
  | 'format-convert'
  | 'sql-insert'
  | 'schema-diff'
  | 'row-diff'
  | 'migration-timeline'
  | 'mock-server'
  | 'postman-import'
  | 'openapi-import'
  | 'icon-library'
  | 'jenkins'
  | 'rehydration'
  | 'jenkinsfile-viz'
  | 'helm-values'
  | 'k8s-lint'
  | 'dockerfile-lint'
  | 'semver'
  | 'cidr'
  | 'health-board'
  | 'http-reference'
  | 'curl-convert'
  | 'url-parser'
  | 'jsonpath'
  | 'sql-format'
  | 'base-convert'
  | 'color-studio'
  | 'unit-convert'
  | 'scratchpad'
  | 'focus-timer'

export type ToolDef = { id: Tool; label: string; hint: string; icon: React.ElementType; isNew?: boolean }
export type ToolGroup = { label: string; tools: ToolDef[] }

export const GROUPS: ToolGroup[] = [
  {
    label: 'Home',
    tools: [
      { id: 'home', label: 'Home', hint: 'favourites · recents · all tools', icon: House },
      { id: 'system', label: 'System', hint: 'health · backup & restore', icon: Gauge },
    ],
  },
  {
    label: 'Vault',
    tools: [{ id: 'vault', label: 'Vault', hint: 'secrets · urls · per environment', icon: LockKey }],
  },
  {
    label: 'CI/CD & Release',
    tools: [
      { id: 'jenkins', label: 'Jenkins Pipeline Studio', hint: 'CI → CD → proceed → helm tag', icon: Rocket, isNew: true },
      { id: 'rehydration', label: 'Rehydration Board', hint: 'helm tags per env · snapshots · redeploy', icon: ArrowsCounterClockwise, isNew: true },
      { id: 'jenkinsfile-viz', label: 'Jenkinsfile Visualizer', hint: 'stages · parallel · inputs · lint', icon: FlowArrow, isNew: true },
      { id: 'helm-values', label: 'Helm Values Merge', hint: 'layer values files · diff envs', icon: Sliders, isNew: true },
      { id: 'k8s-lint', label: 'Kubernetes Manifest Lint', hint: 'limits · probes · :latest · summary', icon: Cube, isNew: true },
      { id: 'dockerfile-lint', label: 'Dockerfile Linter', hint: 'best practices · layer view', icon: Package, isNew: true },
      { id: 'semver', label: 'Semver Toolkit', hint: 'compare · bump · ranges', icon: Tag, isNew: true },
    ],
  },
  {
    label: 'Network & Ops',
    tools: [
      { id: 'health-board', label: 'Env Health Board', hint: 'ping DIT/UAT/PROD health URLs', icon: Heartbeat, isNew: true },
      { id: 'cidr', label: 'CIDR / Subnet Calculator', hint: 'ranges · masks · split · contains', icon: NetworkSlash, isNew: true },
      { id: 'curl-convert', label: 'cURL Converter', hint: 'curl → fetch · Java · Python · Spring', icon: TerminalWindow, isNew: true },
      { id: 'url-parser', label: 'URL Parser & Builder', hint: 'parts · query params · encode', icon: LinkSimple, isNew: true },
      { id: 'http-reference', label: 'HTTP Reference', hint: 'status codes · headers · methods', icon: Info, isNew: true },
    ],
  },
  {
    label: 'Visualizers',
    tools: [
      { id: 'diagram-studio', label: 'Diagram Studio', hint: 'mermaid code · freeform canvas', icon: Shapes },
      { id: 'spring-viz', label: 'Spring Boot Visualizer', hint: 'controllers · services · routes', icon: TreeStructure },
      { id: 'git-graph', label: 'Git Commit Graph', hint: 'branch & merge visualizer', icon: GitCommit },
      { id: 'changelog-generator', label: 'Changelog Generator', hint: 'git log → grouped release notes', icon: ClipboardText },
      { id: 'git-repo', label: 'Git Repo Overview', hint: 'status · branches · fetch', icon: GitBranch },
      { id: 'disk-treemap', label: 'Disk Usage Treemap', hint: 'where the space went', icon: SquaresFour },
    ],
  },
  {
    label: 'Everyday & Data Tools',
    tools: [
      { id: 'image-tools', label: 'Image Tools', hint: 'convert · enhance · remove bg', icon: Image },
      { id: 'svg-tools', label: 'SVG Tools', hint: 'optimize · convert · trace', icon: PenNib },
      { id: 'pdf-tools', label: 'PDF Converter', hint: 'images ↔ pdf', icon: FilePdf },
      { id: 'task-list', label: 'Task List', hint: 'to-dos with timings', icon: ListChecks },
      { id: 'file-search', label: 'File Search', hint: 'grep any file', icon: ListMagnifyingGlass },
      { id: 'json-xml', label: 'JSON / XML', hint: 'format · convert · → TypeScript', icon: BracketsCurly },
      { id: 'sql', label: 'SQL Workspace', hint: 'connect · query · ER diagram', icon: Database },
      { id: 'api-client', label: 'API Client', hint: 'request · collections · response', icon: PaperPlaneTilt },
      { id: 'plsql-analyzer', label: 'PL/SQL Analyzer', hint: 'call graph · table usage · risks', icon: Stack },
      { id: 'notes', label: 'Notes', hint: 'folders · links · export', icon: Notebook },
      { id: 'list-convert', label: 'List Converter', hint: "a,b,c → ('a','b','c')", icon: ListNumbers },
      { id: 'avro-schema', label: 'Avro Schema Tool', hint: 'compat check · hive ddl', icon: FileCode },
      { id: 'csv-profiler', label: 'Delimited File Profiler', hint: 'streams huge CSV/TSV', icon: ChartPieSlice },
      { id: 'part-merge', label: 'Part-File Merger', hint: 'merge part-* output', icon: GitMerge },
    ],
  },
  {
    label: 'Text & Dev Utilities',
    tools: [
      { id: 'diff', label: 'Diff', hint: 'compare two texts', icon: GitDiff },
      { id: 'encode', label: 'Encode / Decode', hint: 'base64 · jwt · hash', icon: Hash },
      { id: 'time', label: 'Time Toolkit', hint: 'epoch · tz · cron', icon: Clock },
      { id: 'regex', label: 'Regex Lab', hint: 'test · diagram', icon: MagicWand },
      { id: 'text', label: 'Text Toolkit', hint: 'case · sort · wrap', icon: TextAa },
      {
        id: 'hinglish-convert',
        label: 'Hinglish Converter',
        hint: 'Tanglish/Tenglish/Hinglish → English + Hindi',
        icon: Translate,
      },
      { id: 'data-gen', label: 'Data Generator', hint: 'uuid · ulid · fake data', icon: Fingerprint },
      { id: 'command-templates', label: 'Command Templates', hint: 'fill-in-the-blank commands · history', icon: Terminal },
      { id: 'jsonpath', label: 'JSONPath Playground', hint: 'query JSON live · $..items[?(@.x)]', icon: Path, isNew: true },
      { id: 'sql-format', label: 'SQL Formatter', hint: 'pretty-print · minify · uppercase', icon: Code, isNew: true },
      { id: 'base-convert', label: 'Base & Bitwise', hint: 'hex · bin · oct · dec · bit ops', icon: Binary, isNew: true },
      { id: 'unit-convert', label: 'Unit Converter', hint: 'bytes · durations · rates', icon: Ruler, isNew: true },
    ],
  },
  {
    label: 'Focus & Design',
    tools: [
      { id: 'scratchpad', label: 'Scratchpad', hint: 'multi-tab autosaving notes', icon: NotePencil, isNew: true },
      { id: 'focus-timer', label: 'Focus Timer', hint: 'pomodoro · stopwatch · countdown', icon: Timer, isNew: true },
      { id: 'color-studio', label: 'Color Studio', hint: 'contrast · palettes · convert', icon: Palette, isNew: true },
    ],
  },
  {
    label: 'Backend, Web & Ops',
    tools: [
      { id: 'stack-trace', label: 'Stack Trace Analyzer', hint: 'collapse the noise', icon: Warning },
      { id: 'dep-tree', label: 'Dependency Tree', hint: 'maven / gradle', icon: Stack },
      { id: 'spring-config', label: 'Spring Config', hint: 'yaml/properties diff · effective config', icon: Wrench },
      { id: 'jar-inspect', label: 'JAR Inspector', hint: 'manifest · classes · dupes', icon: FileZip },
      { id: 'top-analyzer', label: 'top / ps Analyzer', hint: 'sort · diff snapshots', icon: Gauge },
      { id: 'reference-handbook', label: 'Reference Handbook', hint: 'linux · makefile · git', icon: Terminal },
      { id: 'bundle-stats', label: 'Bundle Stats', hint: "what's inflating it", icon: ChartBar },
      { id: 'jacoco-viewer', label: 'JaCoCo Coverage Viewer', hint: 'worst-covered classes first', icon: Percent },
      { id: 'jwt-inspector', label: 'JWT Inspector', hint: 'claims · expiry · HMAC verify', icon: Key },
      { id: 'cors-check', label: 'CORS Checker', hint: 'why the preflight failed', icon: Globe },
      { id: 'aws-helpers', label: 'AWS Helpers', hint: 'ARN · IAM · certs', icon: ShieldCheck },
    ],
  },
  {
    label: 'Log & Debug Tools',
    tools: [
      { id: 'log-tailer', label: 'Log Tailer', hint: 'live tail · filter · highlight', icon: Terminal },
      { id: 'log-pattern-miner', label: 'Log Pattern Miner', hint: 'cluster huge logs into patterns', icon: ChartBar },
      { id: 'thread-dump', label: 'Thread Dump Analyzer', hint: 'deadlocks · thread states', icon: Bug },
    ],
  },
  {
    label: 'Data & Migration Tools',
    tools: [
      { id: 'format-convert', label: 'Format Converter', hint: 'YAML · JSON · TOML · .properties', icon: ArrowsClockwise },
      { id: 'sql-insert', label: 'CSV/Excel → SQL', hint: 'generate INSERT statements', icon: Database },
      { id: 'schema-diff', label: 'Schema/Migration Diff', hint: 'flag risky DDL changes', icon: GitDiff },
      { id: 'row-diff', label: 'Row-level Data Diff', hint: 'CSV/JSON, cell-by-cell', icon: Table },
      { id: 'migration-timeline', label: 'Migration Timeline', hint: 'Flyway/Liquibase · risky DDL flags', icon: Stairs },
    ],
  },
  {
    label: 'Frontend & API Tools',
    tools: [
      { id: 'mock-server', label: 'Mock Server', hint: 'serve JSON endpoints locally', icon: Robot },
      { id: 'postman-import', label: 'Postman/Insomnia Import', hint: 'into API Client collections', icon: CloudArrowDown },
      { id: 'openapi-import', label: 'OpenAPI/Swagger Import', hint: 'spec → API Client collections', icon: FileArrowDown },
      { id: 'icon-library', label: 'Icon Library', hint: 'browse · copy SVG/JSX', icon: SquaresFour },
    ],
  },
]

export const ALL_TOOLS: ToolDef[] = GROUPS.flatMap((g) => g.tools)
const TOOL_DEFS: Record<Tool, ToolDef> = Object.fromEntries(ALL_TOOLS.map((t) => [t.id, t])) as Record<Tool, ToolDef>

const FAVOURITES_KEY = 'devtools.favourite-tools'

function loadFavourites(): Tool[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* corrupt storage — start with no favourites */
  }
  return []
}

function renderPage(tool: Tool, homeProps: { favourites: Tool[]; recents: Tool[]; onOpenTool: (id: Tool) => void }) {
  switch (tool) {
    case 'home': return <HomePage favourites={homeProps.favourites} recents={homeProps.recents} onOpenTool={homeProps.onOpenTool} />
    case 'system': return <SystemPage />
    case 'diagram-studio': return <DiagramStudioPage />
    case 'spring-viz': return <SpringVizPage />
    case 'git-graph': return <GitGraphPage />
    case 'changelog-generator': return <ChangelogGeneratorPage />
    case 'disk-treemap': return <DiskTreemapPage />
    case 'image-tools': return <ImageToolsPage />
    case 'pdf-tools': return <PdfToolsPage />
    case 'task-list': return <TaskListPage />
    case 'file-search': return <FileSearchPage />
    case 'json-xml': return <JsonXmlPage />
    case 'sql': return <SqlPage />
    case 'list-convert': return <ListConverterPage />
    case 'notes': return <NotesPage />
    case 'avro-schema': return <AvroSchemaPage />
    case 'csv-profiler': return <CsvProfilerPage />
    case 'part-merge': return <PartMergePage />
    case 'diff': return <DiffPage />
    case 'encode': return <EncodeDecodePage />
    case 'time': return <TimeToolkitPage />
    case 'regex': return <RegexLabPage />
    case 'text': return <TextToolkitPage />
    case 'hinglish-convert': return <HinglishConverterPage />
    case 'data-gen': return <DataGeneratorPage />
    case 'vault': return <VaultPage />
    case 'git-repo': return <GitRepoPage />
    case 'command-templates': return <CommandTemplatesPage />
    case 'plsql-analyzer': return <PlSqlAnalyzerPage />
    case 'svg-tools': return <SvgToolsPage />
    case 'api-client': return <ApiClientPage />
    case 'stack-trace': return <StackTracePage />
    case 'dep-tree': return <DependencyTreePage />
    case 'spring-config': return <SpringConfigPage />
    case 'jar-inspect': return <JarInspectPage />
    case 'top-analyzer': return <TopAnalyzerPage />
    case 'reference-handbook': return <ReferenceHandbookPage />
    case 'bundle-stats': return <BundleStatsPage />
    case 'jacoco-viewer': return <JacocoViewerPage />
    case 'jwt-inspector': return <JwtInspectorPage />
    case 'cors-check': return <CorsCheckPage />
    case 'aws-helpers': return <AwsHelpersPage />
    case 'log-tailer': return <LogTailerPage />
    case 'log-pattern-miner': return <LogPatternMinerPage />
    case 'thread-dump': return <ThreadDumpAnalyzerPage />
    case 'format-convert': return <FormatConverterPage />
    case 'sql-insert': return <SqlInsertPage />
    case 'schema-diff': return <SchemaDiffPage />
    case 'row-diff': return <RowDiffPage />
    case 'migration-timeline': return <MigrationTimelinePage />
    case 'mock-server': return <MockServerPage />
    case 'postman-import': return <PostmanImportPage />
    case 'openapi-import': return <OpenApiImportPage />
    case 'jenkins': return <JenkinsStudioPage onOpenTool={homeProps.onOpenTool} />
    case 'rehydration': return <RehydrationBoardPage />
    case 'jenkinsfile-viz': return <JenkinsfileVizPage />
    case 'helm-values': return <HelmValuesPage />
    case 'k8s-lint': return <K8sLintPage />
    case 'dockerfile-lint': return <DockerfileLintPage />
    case 'semver': return <SemverPage />
    case 'cidr': return <CidrPage />
    case 'health-board': return <HealthBoardPage />
    case 'http-reference': return <HttpReferencePage />
    case 'curl-convert': return <CurlConvertPage />
    case 'url-parser': return <UrlParserPage />
    case 'jsonpath': return <JsonPathPage />
    case 'sql-format': return <SqlFormatPage />
    case 'base-convert': return <BaseConvertPage />
    case 'color-studio': return <ColorStudioPage />
    case 'unit-convert': return <UnitConvertPage />
    case 'scratchpad': return <ScratchpadPage />
    case 'focus-timer': return <FocusTimerPage />
    case 'icon-library': return <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ink-faint">Loading icon set…</div>}><IconLibraryPage /></Suspense>
  }
}

const SESSION_KEY = 'devtools.session'
const RECENTS_KEY = 'devtools.recent-tools'
const MAX_RECENTS = 8
const SIDEBAR_KEY = 'devtools.sidebar-open'

function loadSession(): { openTabs: Tool[]; activeTab: Tool } {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.openTabs) && parsed.openTabs.length > 0 && parsed.activeTab) return parsed
    }
  } catch {
    /* corrupt storage — start fresh */
  }
  return { openTabs: ['home'], activeTab: 'home' }
}

function loadRecents(): Tool[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* corrupt storage — start with no recents */
  }
  return []
}

function App() {
  const initialSession = useMemo(loadSession, [])
  const [openTabs, setOpenTabs] = useState<Tool[]>(initialSession.openTabs)
  const [activeTab, setActiveTab] = useState<Tool>(initialSession.activeTab)
  const [favourites, setFavourites] = useState<Tool[]>(loadFavourites)
  const [recents, setRecents] = useState<Tool[]>(loadRecents)
  // No stored preference yet: start collapsed on narrow viewports (tablets/phones reaching the app over the LAN).
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY)
    return stored === null ? window.innerWidth >= 900 : stored !== '0'
  })
  const [navFilter, setNavFilter] = useState('')
  const [tabOverflowOpen, setTabOverflowOpen] = useState(false)
  const [hasHiddenTabs, setHasHiddenTabs] = useState(false)
  const tabRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyFont(getStoredFont())
  }, [])

  useEffect(() => {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites))
  }, [favourites])

  // Restores exactly which tools were open and which was active on reload — a real session, not a fresh start.
  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ openTabs, activeTab }))
  }, [openTabs, activeTab])

  useEffect(() => {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents))
  }, [recents])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? '1' : '0')
  }, [sidebarOpen])

  function openTool(id: Tool) {
    setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]))
    setActiveTab(id)
    setRecents((r) => [id, ...r.filter((x) => x !== id)].slice(0, MAX_RECENTS))
  }

  function closeTab(id: Tool) {
    setOpenTabs((tabs) => {
      const idx = tabs.indexOf(id)
      const next = tabs.filter((t) => t !== id)
      if (next.length === 0) return ['home']
      if (id === activeTab) {
        setActiveTab(next[Math.min(idx, next.length - 1)])
      }
      return next
    })
  }

  function toggleFavourite(id: Tool) {
    setFavourites((favs) => (favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]))
  }

  // Ctrl+W and Ctrl+Tab are hard-reserved by every real browser for its own tab chrome — page JS
  // can never intercept them, even with preventDefault. Alt+W / Alt+] / Alt+[ aren't reserved.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey) return
      if (e.key.toLowerCase() === 'w') {
        e.preventDefault()
        closeTab(activeTab)
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        cycleTheme(e.shiftKey ? -1 : 1)
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarOpen((v) => !v)
      } else if (e.key === ']' || e.key === '[') {
        e.preventDefault()
        const idx = openTabs.indexOf(activeTab)
        const delta = e.key === ']' ? 1 : -1
        const nextIdx = (idx + delta + openTabs.length) % openTabs.length
        setActiveTab(openTabs[nextIdx])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openTabs, activeTab])

  // Cross-tool navigation (e.g. Rehydration Board → "open this build in Pipeline Studio").
  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<string>).detail as Tool
      if (TOOL_DEFS[id]) openTool(id)
    }
    window.addEventListener('devtools:open-tool', onOpen)
    return () => window.removeEventListener('devtools:open-tool', onOpen)
  })

  const paletteItems: PaletteItem<Tool>[] = useMemo(
    () => GROUPS.flatMap((group) => group.tools.map((t) => ({ id: t.id, label: t.label, hint: t.hint, group: group.label, icon: t.icon }))),
    []
  )

  const navQuery = navFilter.trim().toLowerCase()
  const matchesFilter = (t: ToolDef) => !navQuery || t.label.toLowerCase().includes(navQuery) || t.hint.toLowerCase().includes(navQuery)
  const filteredFavourites = favourites.map((id) => TOOL_DEFS[id]).filter(Boolean).filter(matchesFilter)
  const filteredGroups = GROUPS.map((group) => ({ ...group, tools: group.tools.filter(matchesFilter) })).filter((group) => group.tools.length > 0)

  useEffect(() => {
    const el = tabRowRef.current
    if (!el) return
    const check = () => setHasHiddenTabs(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [openTabs])

  const activeDef = TOOL_DEFS[activeTab]
  const totalTools = ALL_TOOLS.filter((t) => t.id !== 'home').length

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-void text-ink">
      <Backdrop />
      <div className="noise-overlay" />
      <CursorFx />

      <aside
        className="app-sidebar relative z-10 flex shrink-0 flex-col overflow-hidden border-r border-rule-soft bg-surface transition-[width] duration-300 ease-out"
        style={{ width: sidebarOpen ? '17.5rem' : 0 }}
      >
        <div className="flex h-full w-[17.5rem] shrink-0 flex-col overflow-hidden">
        <div className="shrink-0 p-3 pb-0">
          <button onClick={() => openTool('home')} className="group mb-4 flex w-full items-center gap-2.5 px-2 pt-2 text-left">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-glass ring-1 ring-glass-strong">
              <CircleDashed size={24} weight="bold" className="brand-mark text-cyan" />
              <Sparkle size={11} weight="fill" className="absolute -right-0.5 -top-0.5 text-rose" />
            </span>
            <div className="min-w-0">
              <div className="font-display gradient-text text-[1.75rem] leading-none">Dev Tools</div>
              <div className="mt-0.5 whitespace-nowrap text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ink-faint">{totalTools} tools · offline</div>
            </div>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="flex-1"><CommandPalette items={paletteItems} onSelect={openTool} favourites={favourites} recents={recents} /></div>
            <GlobalSearch onOpenTool={(id) => openTool(id as Tool)} />
          </div>
          <div className="relative mt-2">
            <MagnifyingGlass size={15} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={navFilter}
              onChange={(e) => setNavFilter(e.target.value)}
              placeholder="Filter tools…"
              aria-label="Filter tools"
              className="w-full rounded-xl border border-rule bg-panel py-2 pl-9 pr-2 text-[0.875rem] text-ink outline-none transition-shadow focus:border-cyan/50 focus:shadow-[var(--focus-ring)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {filteredFavourites.length > 0 && (
            <nav className="flex flex-col gap-0.5 pb-2">
              <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-warm">
                <Star size={11} weight="fill" /> Favourites
              </div>
              {filteredFavourites.map((t) => (
                <NavRow key={t.id} tool={t} active={activeTab === t.id} isFavourite onOpen={openTool} onToggleFavourite={toggleFavourite} />
              ))}
            </nav>
          )}

          {navQuery && filteredGroups.length === 0 && (
            <div className="px-3 py-6 text-center text-[0.875rem] text-ink-faint">No tools match "{navFilter.trim()}"</div>
          )}

          {filteredGroups.map((group) => (
            <nav key={group.label} className="flex flex-col gap-0.5 pb-2">
              <div className="px-3 pb-1 pt-3 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
                {group.label}
              </div>
              {group.tools.map((t) => (
                <NavRow
                  key={t.id}
                  tool={t}
                  active={activeTab === t.id}
                  isFavourite={favourites.includes(t.id)}
                  onOpen={openTool}
                  onToggleFavourite={toggleFavourite}
                />
              ))}
            </nav>
          ))}
        </div>

        <div className="shrink-0 border-t border-rule-soft p-3">
          <SettingsPopover />
        </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden p-3 md:p-5">
        <div className="mb-3 flex shrink-0 items-center gap-1">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={`${sidebarOpen ? 'Hide' : 'Show'} sidebar (Alt+B)`}
            aria-label={`${sidebarOpen ? 'Hide' : 'Show'} sidebar`}
            className="shrink-0 rounded-xl p-2 text-ink-faint transition-colors hover:bg-glass hover:text-ink"
          >
            <SidebarSimple size={19} weight="bold" />
          </button>
          {openTabs.length > 1 && (
            <>
            <div ref={tabRowRef} className="flex flex-1 items-center gap-1 overflow-x-auto">
              {openTabs.map((id) => {
                const t = TOOL_DEFS[id]
                const Icon = t.icon
                const active = id === activeTab
                const isFav = favourites.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    title="Alt+] / Alt+[ to cycle tabs, Alt+W to close"
                    className={`group relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[0.875rem] font-medium transition-colors ${
                      active ? 'text-ink' : 'text-ink-faint hover:bg-glass hover:text-ink-soft'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="tab-active"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="nav-active-pill absolute inset-0 rounded-xl"
                      />
                    )}
                    <Icon size={15} weight={active ? 'duotone' : 'light'} className={`relative ${active ? 'text-cyan' : ''}`} />
                    <span className="relative">{t.label}</span>
                    <Star
                      size={12}
                      weight={isFav ? 'fill' : 'light'}
                      className={`relative transition-opacity ${isFav ? 'text-warm' : 'opacity-0 hover:text-warm group-hover:opacity-100'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavourite(id)
                      }}
                    />
                    <X
                      size={12}
                      weight="bold"
                      className="relative opacity-0 transition-opacity hover:text-rose group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(id)
                      }}
                    />
                  </button>
                )
              })}
            </div>
            {hasHiddenTabs && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setTabOverflowOpen((v) => !v)}
                  className="flex items-center gap-0.5 rounded-xl px-2 py-2 text-[0.8125rem] text-ink-faint transition-colors hover:bg-glass hover:text-ink-soft"
                  title="More open tabs"
                >
                  <CaretDown size={13} weight="bold" />
                </button>
                {tabOverflowOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setTabOverflowOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 flex max-h-80 w-64 flex-col gap-0.5 overflow-auto rounded-xl border border-rule bg-surface p-1.5 shadow-2xl">
                      {openTabs.map((id) => {
                        const t = TOOL_DEFS[id]
                        const Icon = t.icon
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              setActiveTab(id)
                              setTabOverflowOpen(false)
                            }}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.875rem] transition-colors ${
                              id === activeTab ? 'bg-glass-strong text-ink' : 'text-ink-soft hover:bg-glass'
                            }`}
                          >
                            <Icon size={15} weight="light" className={id === activeTab ? 'text-cyan' : 'text-ink-faint'} />
                            <span className="truncate">{t.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => setOpenTabs([activeTab])}
              className="shrink-0 whitespace-nowrap rounded-xl px-2.5 py-2 text-[0.8125rem] text-ink-faint transition-colors hover:bg-glass hover:text-ink-soft"
              title="Close all other tabs"
            >
              Close others
            </button>
            </>
          )}
        </div>

        {activeTab !== 'home' && activeDef && <ToolHeader key={activeTab} tool={activeDef} />}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {openTabs.map((id) => (
            <div key={id} className="page-slot absolute inset-0" style={{ display: id === activeTab ? 'block' : 'none' }}>
              {renderPage(id, { favourites, recents, onOpenTool: openTool })}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function ToolHeader({ tool }: { tool: ToolDef }) {
  const Icon = tool.icon
  return (
    <div className="mb-3 flex min-w-0 shrink-0 items-center gap-3">
      <span className="tool-header-chip">
        <Icon size={21} weight="duotone" />
      </span>
      <div className="tool-header-title min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="font-display gradient-text m-0 truncate text-[1.85rem] leading-none">{tool.label}</h1>
          {tool.isNew && (
            <span className="shrink-0 rounded-full bg-rose px-2 py-0.5 text-[0.6875rem] font-extrabold uppercase tracking-wider text-[var(--on-accent)]">new</span>
          )}
        </div>
        <div className="truncate text-[0.875rem] text-ink-faint">{tool.hint}</div>
      </div>
    </div>
  )
}

function NavRow({
  tool,
  active,
  isFavourite,
  onOpen,
  onToggleFavourite,
}: {
  tool: ToolDef
  active: boolean
  isFavourite: boolean
  onOpen: (id: Tool) => void
  onToggleFavourite: (id: Tool) => void
}) {
  const Icon = tool.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{ x: active ? 0 : 3 }}
      className="nav-row group relative rounded-2xl"
    >
      {active && (
        <motion.div
          layoutId="nav-active"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="nav-active-pill absolute inset-0 rounded-2xl"
        />
      )}
      <button onClick={() => onOpen(tool.id)} className="relative flex w-full items-center gap-3 py-2 pl-3 pr-8 text-left">
        <Icon size={19} weight={active ? 'duotone' : 'light'} className={`nav-icon shrink-0 ${active ? 'text-cyan' : 'text-ink-faint group-hover:text-ink-soft'}`} />
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-1.5 text-[0.9375rem] font-semibold leading-tight ${active ? 'text-ink' : 'text-ink-soft'}`}>
            <span className="truncate">{tool.label}</span>
            {tool.isNew && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose pulse-dot" title="New" />}
          </div>
          <div className="truncate text-[0.8125rem] leading-snug text-ink-faint">{tool.hint}</div>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavourite(tool.id)
        }}
        className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${
          isFavourite ? 'text-warm' : 'text-ink-faint opacity-0 hover:text-warm focus-visible:opacity-100 group-hover:opacity-100'
        }`}
        title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        aria-label={isFavourite ? `Remove ${tool.label} from favourites` : `Add ${tool.label} to favourites`}
      >
        <Star size={14} weight={isFavourite ? 'fill' : 'light'} />
      </button>
    </motion.div>
  )
}

export default App
