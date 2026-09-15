import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import java from 'highlight.js/lib/languages/java'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('java', java)
hljs.registerLanguage('python', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)

const renderer = new marked.Renderer()
renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : null
  const result = language ? hljs.highlight(text, { language }).value : hljs.highlightAuto(text).value
  return `<pre class="hljs-block"><code class="hljs${language ? ` language-${language}` : ''}">${result}</code></pre>`
}
marked.use({ renderer })

/**
 * {color:NAME}text{/color} and {highlight}text{/highlight} are a lightweight, markdown-safe
 * inline-color syntax (curly braces don't collide with anything marked/commonmark parses) —
 * substituted to raw <span>/<mark> HTML before marked runs, same technique NotesPage already
 * uses for [[wiki links]]. Marked passes untouched inline HTML straight through its tokenizer.
 */
function applyInlineColorSyntax(md: string): string {
  return md
    .replace(/\{color:([a-zA-Z0-9#]+)\}([\s\S]*?)\{\/color\}/g, (_m, color, inner) => `<span style="color:${color}">${inner}</span>`)
    .replace(/\{highlight(?::([a-zA-Z0-9#]+))?\}([\s\S]*?)\{\/highlight\}/g, (_m, color, inner) =>
      `<mark${color ? ` style="background:${color}"` : ''}>${inner}</mark>`
    )
}

export function markdownToSafeHtml(md: string): string {
  const raw = marked.parse(applyInlineColorSyntax(md), { async: false, breaks: true }) as string
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['style', 'class'] })
}

function slugify(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type ExportableNote = { title: string; body: string; tags?: string | null; createdAt: string; updatedAt: string }

export function exportNoteAsMarkdown(note: ExportableNote) {
  const frontmatter = [
    '---',
    `title: "${note.title.replace(/"/g, '\\"')}"`,
    `tags: "${(note.tags ?? '').replace(/"/g, '\\"')}"`,
    `created: ${note.createdAt}`,
    `updated: ${note.updatedAt}`,
    '---',
    '',
    '',
  ].join('\n')
  downloadFile(`${slugify(note.title)}.md`, frontmatter + note.body, 'text/markdown')
}

/** Self-contained: all CSS inlined, no external requests, dark-themed to match the app — one file that renders identically anywhere. */
const EXPORT_HTML_STYLE = `
  body { background:#050506; color:#f2f4f8; font-family:-apple-system,'Segoe UI',sans-serif; max-width:720px; margin:0 auto; padding:3rem 1.5rem; line-height:1.65; }
  h1,h2,h3 { color:#fff; line-height:1.3; }
  h1 { font-size:1.9rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem; }
  a { color:#2fe6f2; }
  code { background:rgba(255,255,255,0.08); padding:0.15rem 0.4rem; border-radius:0.3rem; font-family:'JetBrains Mono',monospace; font-size:0.9em; }
  pre { background:#0b0c11; border:1px solid rgba(255,255,255,0.08); border-radius:0.75rem; padding:1rem; overflow-x:auto; }
  pre code { background:none; padding:0; }
  blockquote { border-left:3px solid rgba(47,230,242,0.4); margin:0; padding-left:1rem; color:#9ba1b0; }
  table { border-collapse:collapse; width:100%; }
  th,td { border:1px solid rgba(255,255,255,0.1); padding:0.5rem 0.75rem; text-align:left; }
  .meta { color:#5c6274; font-size:0.85rem; margin-bottom:2rem; }
  @media print { body { color:#000; background:#fff; } a { color:#0066cc; } }
`

export function exportNoteAsHtml(note: ExportableNote) {
  const bodyHtml = markdownToSafeHtml(note.body)
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(note.title)}</title>
<style>${EXPORT_HTML_STYLE}</style>
</head>
<body>
<h1>${escapeHtml(note.title)}</h1>
<div class="meta">Updated ${new Date(note.updatedAt).toLocaleString()}${note.tags ? ' · ' + escapeHtml(note.tags) : ''}</div>
${bodyHtml}
</body>
</html>`
  downloadFile(`${slugify(note.title)}.html`, page, 'text/html')
}

export function exportTextAsFile(filename: string, content: string, format: 'markdown' | 'html' | 'text') {
  if (format === 'html') {
    downloadFile(filename.endsWith('.html') ? filename : `${filename}.html`, content, 'text/html')
  } else if (format === 'markdown') {
    downloadFile(filename.endsWith('.md') ? filename : `${filename}.md`, content, 'text/markdown')
  } else {
    downloadFile(filename, content, 'text/plain')
  }
}
