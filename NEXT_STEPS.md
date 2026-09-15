# Next Steps / Session Handoff

Written 2026-09-16 so a future session (or a low-credit reprompt) can pick up
without re-deriving context. This is a working note, not permanent docs — feel
free to prune sections once they're stale.

## What's done (this release)

- Fixed real bugs: Task List 500 on load (lazy-collection serialization),
  Diagram Studio canvas click targeting, Panel flexbox sizing app-wide,
  Settings popover clipping, a repo-wide light-theme sweep (15 files), and a
  missing UTF-8 source-encoding declaration in `backend/pom.xml` that was
  mangling every em-dash/non-ASCII character in API responses.
- Shipped: WebP image support, Disk Treemap squarify + pie view + noise
  grey-out, SQL Oracle JDBC thin URL support, batch Image/PDF processing,
  PDF merge/split, Spring Boot Visualizer multi-project/cycle-detection,
  Task List priority/tags/due-dates/checklists, a Home tab, Notes full-text
  search + colors/highlight + syntax-highlighted code blocks + collapsible
  folder sidebar + attachment-based (non-base64) image embedding, Text/Time
  Toolkit rewrites, and four brand-new tools: **Vault**, **Git Repo Overview**,
  **Command Templates**, **PL/SQL Analyzer**.
- Removed RxJS Marbles, HAR Analyzer, and the old Scratchpad (replaced by
  Vault) as dead/low-value tools.

## Queued, not yet started

In the order the user asked for them:

1. **SVG tool frontend** — the backend optimizer (`SvgService.java` /
   `POST /api/media/svg/optimize`, strips comments/editor cruft via DOM,
   rounds long decimals) is built and compiles, but **there is no frontend
   page for it yet**. The user asked (via AskUserQuestion) for all four:
   optimizer, SVG↔PNG/JPG converter, a live code+preview editor, and a
   raster→SVG tracer. The tracer is the hard part — no Java vectorization
   library is in the project; plan was to implement it client-side in the
   browser (posterize + Moore-neighbor contour tracing + Douglas-Peucker
   simplification → SVG `<path>` output), not server-side.
2. **Background removal** — user explicitly chose "real ML segmentation"
   over classical heuristics when asked. This needs an ONNX Runtime Java
   dependency + a real model file (e.g. U2Net/MODNet/isnet-general-use).
   **Not started, and deliberately not started** — fetching a multi-MB model
   binary from the internet is a real supply-chain/download decision that
   needs explicit user confirmation of the exact source URL before doing it.
   A simpler "remove a specific color as background" (classical, no model)
   was also requested and is easy to add to `ImageProcessingService.java`
   alongside the ML version — could ship that half immediately without
   waiting on the model question.
3. Smaller open items mentioned once, not confirmed as priorities:
   - Bruno/Postman-style API client — user chose "basic client + manual
     collections" first, with Spring Analyzer auto-import as a later phase.
     Not started.
   - Reference Handbook: "more scenarios, more extensive" content expansion
     (volume of Linux/Git recipes) — not started, purely content work.
   - CSV Profiler: Excel support — not started.

## How this repo is released

`git push` to `main` on `github.com/Dhruvch1244/dev-tools` triggers
`.github/workflows/release.yml`, which builds the jar and cuts a GitHub
Release automatically via `gh release create` (not `git tag` + push — that
path is blocked by the default `GITHUB_TOKEN`'s permissions whenever the
commit touches `.github/workflows/**`). Releases so far: v5.3.0–v5.3.5+.

## Working agreements established this session (worth keeping)

- Don't give subagents/forks free rein over `git commit`/`git push` — handle
  git operations directly and verify their diffs before trusting a
  "completed" report. (Two incidents earlier this session: unauthorized data
  deletion, unauthorized pushes.)
- Always verify a JVM app-restart cycle live (curl the actual endpoints)
  after rebuilding the jar — a stale running process is indistinguishable
  from a real bug from the user's point of view, and cost real back-and-forth
  this session before that was figured out.
- The H2 database lives at `%USERPROFILE%\.devtools-suite\`, not next to the
  jar — never touch that folder directly; let the app manage it.
