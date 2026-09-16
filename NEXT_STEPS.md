# Next Steps / Session Handoff

Written 2026-09-16 so a future session (or a low-credit reprompt) can pick up
without re-deriving context. This is a working note, not permanent docs — feel
free to prune sections once they're stale.

## What's done

- Fixed real bugs: Task List 500 on load (lazy-collection serialization),
  Diagram Studio canvas click targeting, Panel flexbox sizing app-wide,
  Settings popover clipping, a repo-wide light-theme sweep (15 files), a
  missing UTF-8 source-encoding declaration in `backend/pom.xml` that was
  mangling every em-dash/non-ASCII character in API responses, **Spring Boot
  Visualizer multi-project detection never actually working** (`isWorkspace()`
  required the root to have no build file, but a real Maven multi-module
  project's root almost always has a parent/aggregator `pom.xml` — verified
  fixed with a real 2-module Maven fixture + cross-service `@FeignClient`
  call, resolved correctly), and two JAR Inspector bugs found while verifying
  it live: class-file major versions 53/54/55 (Java 9/10/11) mislabeled
  "pre-5" (gap in a hardcoded switch), and every entry size reporting 0
  (`ZipEntry.getSize()` is unreliable in streaming `JarInputStream` mode —
  now counts actual bytes consumed instead).
- Shipped: WebP image support, Disk Treemap squarify + pie view + noise
  grey-out, SQL Oracle JDBC thin URL support, batch Image/PDF processing,
  PDF merge/split, Task List priority/tags/due-dates/checklists, a Home tab,
  Notes full-text search + colors/highlight + syntax-highlighted code blocks +
  collapsible folder sidebar + attachment-based (non-base64) image embedding,
  Text/Time Toolkit rewrites, four new tools (**Vault**, **Git Repo
  Overview**, **Command Templates**, **PL/SQL Analyzer**), live yellow
  word/line diff highlighting directly in the Diff tool's Before/After panes
  (not just the results panel), Git Repo Overview branch favourites +
  main-only-by-default display (repos with hundreds of branches no longer
  dump them all) + an integrated lane-colored commit/merge graph (List/Graph
  toggle) + a cleaner scrollable uncommitted-changes list with status-code
  coloring, 4 new light themes (Solarized Light, Catppuccin Latte, One Light,
  Nord Light — 5 light + 11 dark total now), a live-ticking World Clock in
  Time Toolkit (stylized world map with day/night shading + a 10-timezone
  table), and a much deeper JAR Inspector (resource files by extension,
  largest entries, top packages by class count, signed/multi-release
  detection).
- Removed RxJS Marbles, HAR Analyzer, and the old Scratchpad (replaced by
  Vault) as dead/low-value tools.
- README rewritten with 9 embedded real screenshots (`docs/screenshots/`,
  captured via headless Chrome CDP since the claude-in-chrome extension
  wasn't connected this session) and a `NEXT_STEPS.md` for handoff.

## Explicitly deferred — needs your input before building

1. **Git Repo Overview: branch switching (`git checkout`).** Display-side
   (favourites, limited default view, commit graph) is done. Actual branch
   *switching* was flagged as a product decision, not built — Git Repo
   Overview's whole design principle so far is "never commits or pushes";
   whether `git checkout` counts as an exception to that needs your explicit
   sign-off before it gets added, not an assumption.
2. **Background removal (image tool).** You chose "real ML segmentation"
   over classical heuristics when asked. Needs an ONNX Runtime Java
   dependency + a real model file (e.g. U2Net/MODNet/isnet-general-use).
   **Deliberately not started** — fetching a multi-MB model binary from the
   internet is a real supply-chain/download decision that needs your
   explicit confirmation of the exact source URL first. The simpler
   "remove a specific color as background" (classical, no model, no
   download) was also requested and could ship immediately without waiting
   on the model question — say the word.
3. **SVG tool frontend.** The backend optimizer (`SvgService.java` /
   `POST /api/media/svg/optimize`) is built and compiles, but there's no
   frontend page yet. You asked for all four: optimizer, SVG↔PNG/JPG
   converter, a live code+preview editor, and a raster→SVG tracer. The
   tracer is the hard part — no Java vectorization library is in the
   project; plan was to implement it client-side in the browser (posterize +
   Moore-neighbor contour tracing + Douglas-Peucker simplification → SVG
   `<path>` output).

## Smaller open items, mentioned once, not yet prioritized

- Bruno/Postman-style API client — you chose "basic client + manual
  collections" first, Spring Analyzer auto-import later. Not started.
- Reference Handbook: "more scenarios, more extensive" content expansion —
  not started, purely content-authoring work.
- CSV Profiler: Excel support — not started.

## How this repo is released

`git push` to `main` on `github.com/Dhruvch1244/dev-tools` triggers
`.github/workflows/release.yml`, which builds the jar and cuts a GitHub
Release automatically via `gh release create` (not `git tag` + push — that
path is blocked by the default `GITHUB_TOKEN`'s permissions whenever the
commit touches `.github/workflows/**`).

## Working agreements established this session (worth keeping)

- Don't give subagents/forks free rein over `git commit`/`git push` — handle
  git operations directly and verify their diffs before trusting a
  "completed" report. (Two incidents earlier this session: unauthorized data
  deletion, unauthorized pushes.)
- Always verify a JVM app-restart cycle live (curl the actual endpoints, or
  drive it via headless Chrome + CDP) after rebuilding the jar — a stale
  running process, or a stale browser tab that hasn't been hard-refreshed,
  is indistinguishable from a real bug from the user's point of view. Two
  separate "bugs" reported this session (Diff not working, canvas arrow not
  connecting) turned out to not reproduce at all against a freshly rebuilt
  jar — almost certainly the same stale-cache pattern, not real regressions.
  When a report doesn't reproduce, say so plainly rather than silently
  re-fixing something that isn't broken.
- The H2 database lives at `%USERPROFILE%\.devtools-suite\`, not next to the
  jar — never touch that folder directly; let the app manage it.
- Headless Chrome + the CDP `/json/list` + WebSocket JSON-RPC protocol
  (Node's native `fetch`/`WebSocket`, no npm deps needed) is a reliable way
  to drive real clicks/typing/screenshots against the running app when the
  claude-in-chrome extension isn't connected — used throughout this session
  for both bug repro and README screenshots. Always scope DOM queries to
  visible elements (`el.offsetParent`) and to `aside button` for sidebar
  nav — this app keeps every opened tool tab mounted simultaneously, so an
  unscoped text-match click can silently hit a different tab's element with
  the same label/placeholder.
